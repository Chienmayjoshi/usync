import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  measure,
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { ease, motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Blobs } from '@/ui/Glow';
import { Text } from '@/ui/Text';

import { lineFor, MOOD_FOR, nudgeKind, nudgeLevel } from '@/features/mascot/lines';
import { useNow } from '@/features/mascot/useNow';

import { CARD_H, type CardAnswers, type CardNudge, DealCard, toneFor } from './DealCard';
import { type Card, forMe } from './model';
import { DELETE_MS, dropCommits, HOLD_MS, intentOf, stepCommits } from './stackGesture';

export type Dir = 'left' | 'right';
export type SwipeAction = { label: string; color: string; run: (card: Card) => void };

/** A place on screen a card can be dragged into (the My Deck tray). Window coordinates. */
export type Rect = { x: number; y: number; w: number; h: number };
export type DropTarget = {
  rect: SharedValue<Rect>;
  /** 1 while a card is being dragged, so the target can invite the drop. */
  ready: SharedValue<number>;
  /** 1 while the finger is over the target. */
  hot: SharedValue<number>;
  /** Where the card, as a circle, comes to rest in the target (window coordinates). */
  slot: SharedValue<{ x: number; y: number }>;
  onDrop: (card: Card) => void;
};

/**
 * Carrying a card toward the target: past a line above it the card turns into an 80 circle in its
 * colors (Figma 223:21789, notes 239:23499). MORPH_FROM above the target's top it starts; by
 * MORPH_TO above it is a circle. Dragging back up turns it back into the card.
 */
const MORPH_FROM = 220;
const MORPH_TO = 110;
/** The finger counts as over the target this far above its top (where the circle hangs). */
const DROP_REACH = 120;
const CIRCLE = 80;
/** The pill's token it lands as (Figma 300:25413): 40 square, 12 corners. */
const TOKEN = 40;
const TOKEN_R = 12;

export const isOver = (r: Rect, x: number, y: number) => {
  'worklet';
  return x >= r.x && x <= r.x + r.w && y >= r.y - 24 && y <= r.y + r.h;
};

type Props = {
  cards: Card[];
  /** Horizontal swipes: what right and left do with the top card. */
  actions: Partial<Record<Dir, SwipeAction>>;
  /** Press, then drag the card here to take it. */
  drop?: DropTarget;
  /** Hold flips the card to "Delete task?". */
  onDelete?: (card: Card) => void;
  onUpdate?: (card: Card) => void;
  answer?: (card: Card) => CardAnswers | undefined;
  footer?: (card: Card) => ReactNode;
  /** The front card's height (Figma 394); the Table shortens it on small phones. */
  cardH?: number;
  /** A card to bring to the front ("id@time"), when sent here from Activity or a push. */
  focusId?: string;
};

const THRESHOLD = 110;
const FLING = 900;
/**
 * The stack moving a place, and anything let go that springs home: the reference's spring
 * (methodical-plans-198864.framer.app: stiffness 170, damping 26). Interruptible, so quick swipes
 * in a row carry on from wherever the stack is.
 */
const STACK_SPRING = { stiffness: 170, damping: 26, mass: 1 } as const;
/** Following the finger up or down: half of it, like the reference's rubber band. */
const RUBBER = 0.5;

/**
 * Where a card sits for a given level: 0 is the front, 1 and 2 the tilted cards behind it
 * (Figma 300:25117-8: 302 x 259 tilted -2deg with its top 28.4 down, then 254 x 200 tilted 2deg
 * with its top 4.4 down, for a 394 front), 3 is gone behind them. Offsets are from the front
 * card's centre (52 from the top of the stack); on a shorter card the ones behind shrink in step.
 *
 * Between -1 and 0 a card travels between the front and the back slot: swiped up it tucks away
 * behind the others (drawn beneath them) and fades as it gets there; swiped back down it rises
 * from there, drawn on top, fading in as it comes (dir -1) so it never pops over the front.
 * Each card behind is dimmed 15% a place, as in the reference (dim).
 */
const pose = (level: number, count: number, h: number, dir: number) => {
  'worklet';
  // One scale each, so a card behind is the same card smaller, never squashed (its avatar stays
  // round, its title keeps its shape): Figma's widths, 302 and 254 of 350. Only their tops show
  // above the front card, so those keep Figma's place: 28.4 and 4.4 down the stack.
  const s1 = 302 / 350;
  const s2 = 254 / 350;
  const c = 52 + h / 2;
  const back = { ty: 4.37 + (h * s2) / 2 - c, sx: s2, sy: s2, rot: 2 };
  if (level < 0) {
    const p = Math.min(1, -level);
    return {
      ty: back.ty * p, sx: 1 + (back.sx - 1) * p, sy: 1 + (back.sy - 1) * p, rot: back.rot * p,
      opacity: dir < 0 ? interpolate(level, [-1, -0.6], [0, 1], Extrapolation.CLAMP) : interpolate(level, [-1, -0.8], [0, 1], Extrapolation.CLAMP),
      shade: p,
      dim: 0.3 * p,
    };
  }
  const l = Math.min(level, 2);
  return {
    ty: interpolate(l, [0, 1, 2], [0, 28.37 + (h * s1) / 2 - c, back.ty]),
    sx: interpolate(l, [0, 1, 2], [1, s1, back.sx]),
    sy: interpolate(l, [0, 1, 2], [1, s1, back.sy]),
    rot: interpolate(l, [0, 1, 2], [0, -2, back.rot]),
    // Three cards show at most, and never more than the stack holds: 1 card, no tilted ones.
    opacity: Math.min(interpolate(level, [2, 3], [1, 0], Extrapolation.CLAMP), interpolate(level, [count - 1, count], [1, 0], Extrapolation.CLAMP)),
    shade: interpolate(level, [0, 1], [0, 1], Extrapolation.CLAMP),
    dim: 0.15 * l,
  };
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

// What the finger is doing with the top card.
const IDLE = 0;
/** A quick swipe up (to the back) or down (bring the last one back). */
const STEP = 1;
const SWIPE = 2;
const DRAG = 3;

/**
 * A stack of cards. The top one is live; the next two wait behind it, tilted and shaded.
 *
 * Swipe up and the stack scrolls forward a card, down and the last one comes back, as in
 * assets/deckscroll.mp4. The stack is an endless strip of positions: position p shows
 * cards[(p - anchor) mod n], and `head` (on the UI thread) is where the front is. A swipe only
 * slides `head` one place; nothing is reordered, so there is nothing to snap back and no flicker.
 * Sideways swipes run `actions`; press, then drag, carries the top card into `drop`.
 */
export function CardStack({ cards, actions, drop, onDelete, onUpdate, answer, footer, focusId, cardH = CARD_H }: Props) {
  const s = useStyles();
  const n = cards.length;

  // Where the front is, as React knows it, and which card sits there (kept across data changes).
  const [at, setAt] = useState({ H: 0, id: cards[0]?.id ?? '', idx: 0 });
  let idx = cards.findIndex((c) => c.id === at.id);
  if (idx < 0) idx = Math.min(at.idx, Math.max(0, n - 1));
  const anchor = at.H - idx;
  const cardAt = (p: number) => cards[mod(p - anchor, n)];
  const top = n ? cards[idx] : undefined;

  /** The front of the strip, animated on the UI thread. Whole numbers at rest. */
  const head = useSharedValue(at.H);
  /** Where the front is settling (the target of the last step). */
  const base = useSharedValue(at.H);
  /** Which way the stack last moved: 1 up (the front tucked away), -1 down (one came back). */
  const dir = useSharedValue(1);
  /** The card that just left the front (its strip position), still springing off its finger offset. */
  const leavePos = useSharedValue(Number.NaN);
  const leaveTy = useSharedValue(0);
  const leaveTilt = useSharedValue(0);

  // The finger on the top card.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const enter = useSharedValue(1);
  const flip = useSharedValue(0);
  const armed = useSharedValue(0);
  const over = useSharedValue(0);
  const landing = useSharedValue(0);
  const lifted = useSharedValue(0);
  /** 0..1: the +5% and 2deg lift while the card is swiped up or down (the reference's whileDrag). */
  const tilt = useSharedValue(0);
  const mode = useSharedValue(IDLE);
  /** When the finger came down, so a press-and-hold can be told from a quick swipe. */
  const beganAt = useSharedValue(0);
  const holding = useSharedValue(0);
  /** 1 while the card is carried by hand (swipe or drag), so a scroll of the stack leaves it be. */
  const detached = useSharedValue(0);
  const deleting = useSharedValue(0);
  /** 0 card .. 1 circle, while carried toward the drop target. */
  const morph = useSharedValue(0);
  /** The front card's centre in the window as the drag began, and where the finger held it. */
  const origin = useSharedValue({ x: 0, y: 0 });
  const grab = useSharedValue({ x: 0, y: 0, set: 0 });
  const topHV = useSharedValue(cardH);
  const stackRef = useAnimatedRef<Animated.View>();
  const [back, setBack] = useState<'story' | 'delete'>('story');
  const [topH, setTopHState] = useState(cardH);
  const [stackW, setStackW] = useState(350);
  const setTopH = (h: number) => { setTopHState(h); topHV.set(h); };

  // The front card, if it has sat long enough, carries the partner's mascot and its line.
  const t = useTheme();
  const names = useNames();
  const now = useNow();
  const topKind = top ? nudgeKind(top) : null;
  const topLevel = top && topKind ? nudgeLevel(top, now, names.nudgeMax) : 0;
  const topNudge: CardNudge | undefined = top && topKind && topLevel ? {
    mood: MOOD_FOR[topLevel], line: lineFor(top, topKind, topLevel, names.voices.partner, now, true),
    recipe: names.mascots.partner, bg: t.tones[names.colors.partner].glow[0],
  } : undefined;

  const actionsNow = top && top.request && forMe(top) ? {} : actions;
  const dropNow = top && !forMe(top) ? drop : undefined;
  const can = { left: !!actionsNow.left, right: !!actionsNow.right, scroll: n > 1 };
  const canDrop = !!dropNow;

  // A card that just arrived (you added it, or it came back to the Table) comes to the front, so
  // it never lands somewhere down the stack where you would have to look for it.
  const seen = useRef(new Set(cards.map((c) => c.id)));
  useLayoutEffect(() => {
    const fresh = cards.find((c) => !seen.current.has(c.id));
    for (const c of cards) seen.current.add(c.id);
    if (fresh && fresh.id !== at.id) setAt({ H: at.H, id: fresh.id, idx: cards.indexOf(fresh) });
  }, [cards, at.H, at.id]);

  // Sent here for one card (Activity, a push): it comes to the front, dealt in like a new one.
  // focusId is "id@time", so asking for the same card twice still works.
  const [askedFor, setAskedFor] = useState(focusId);
  if (focusId !== askedFor) {
    setAskedFor(focusId);
    const id = focusId?.split('@')[0];
    const i = id ? cards.findIndex((c) => c.id === id) : -1;
    if (i >= 0 && cards[i].id !== at.id) setAt({ H: at.H, id: cards[i].id, idx: i });
  }

  // A new front card that did not arrive by a scroll or swipe (deleted, answered, added): deal it in.
  const shown = useRef<{ id?: string; H: number }>({ H: at.H });
  useLayoutEffect(() => {
    const prev = shown.current;
    shown.current = { id: top?.id, H: at.H };
    if (top?.id === prev.id) return;
    // The saved copy of a card you just added taking its place: the same card, no second deal-in.
    if (prev.id?.startsWith('drop-') && top?.id && !top.id.startsWith('drop-')) return;
    flip.set(0);
    deleting.set(0);
    setBack('story');
    if (at.H !== prev.H) return;
    ty.set(-40);
    enter.set(0);
    ty.set(withTiming(0, motion.dealIn));
    enter.set(withTiming(1, { duration: 180 }));
  }, [top?.id, at.H, flip, deleting, ty, enter]);

  /** The front moved to `p` (told as the step starts, so React keeps up with fast swipes). */
  const moved = (p: number) => {
    const c = cards.length ? cards[mod(p - anchor, cards.length)] : undefined;
    setAt({ H: p, id: c?.id ?? '', idx: mod(p - anchor, Math.max(1, cards.length)) });
  };
  const run = (dir: Dir, p: number) => {
    if (top) actionsNow[dir]?.run(top);
    moved(p);
  };
  const dropped = (p: number) => {
    if (top) dropNow?.onDrop(top);
    moved(p);
  };

  const release = () => {
    'worklet';
    tx.set(0);
    ty.set(0);
    detached.set(0);
    landing.set(0);
    over.set(0);
    lifted.set(0);
    morph.set(0);
    grab.set({ x: 0, y: 0, set: 0 });
  };

  /**
   * Move the stack a place: 1 sends the front to the back, -1 brings the last one back. The card
   * that leaves the front keeps its finger offset and lift, and springs out of them on its way.
   */
  const moveStack = (by: -1 | 1) => {
    'worklet';
    const target = base.value + by;
    leavePos.set(base.value);
    leaveTy.set(ty.value);
    leaveTilt.set(tilt.value);
    leaveTy.set(withSpring(0, STACK_SPRING));
    leaveTilt.set(withSpring(0, STACK_SPRING));
    ty.set(0);
    tilt.set(0);
    tx.set(withSpring(0, STACK_SPRING));
    dir.set(by);
    base.set(target);
    head.set(withSpring(target, STACK_SPRING));
    scheduleOnRN(moved, target);
    scheduleOnRN(haptics.tick);
  };

  const fly = (dir: Dir) => {
    'worklet';
    // Off to the side while the stack moves up a place behind it.
    const target = base.value + 1;
    head.set(withTiming(target, motion.flyOut));
    tx.set(withTiming(dir === 'right' ? 600 : -600, motion.flyOut, (done) => {
      if (!done) return;
      base.set(target);
      release();
      scheduleOnRN(run, dir, target);
    }));
  };

  const land = () => {
    'worklet';
    const target = base.value + 1;
    head.set(withTiming(target, { duration: 240 }));
    if (dropNow && morph.value > 0.5) {
      // As a circle: it flies into the pill's dot slot and shrinks to the dot's size.
      morph.set(withTiming(1, motion.release));
      const g = grab.value;
      tx.set(withTiming(dropNow.slot.value.x - origin.value.x - g.x, { duration: 240, easing: ease.out }));
      ty.set(withTiming(dropNow.slot.value.y - origin.value.y - g.y, { duration: 240, easing: ease.out }));
    } else {
      // Into the tray: the card shrinks and sinks into the slot while the stack moves up.
      ty.set(withTiming(ty.value + 160, { duration: 240 }));
    }
    landing.set(withTiming(1, { duration: 240, easing: ease.out }, (done) => {
      if (!done) return;
      if (dropNow) dropNow.hot.set(withTiming(0, { duration: 200 }));
      base.set(target);
      release();
      scheduleOnRN(haptics.success);
      scheduleOnRN(dropped, target);
    }));
  };

  const settle = () => {
    'worklet';
    tx.set(withSpring(0, STACK_SPRING));
    ty.set(withSpring(0, STACK_SPRING, (done) => { if (done) detached.set(0); }));
    lifted.set(withTiming(0, motion.release));
    tilt.set(withSpring(0, STACK_SPRING));
    morph.set(withSpring(0, STACK_SPRING));
    head.set(withSpring(base.value, STACK_SPRING));
    grab.set({ x: 0, y: 0, set: 0 });
  };

  const openDelete = () => {
    'worklet';
    if (!onDelete || flip.value > 0.5) return;
    deleting.set(1);
    lifted.set(withTiming(0, motion.release));
    scheduleOnRN(setBack, 'delete');
    scheduleOnRN(haptics.take);
    flip.set(withTiming(1, motion.flip));
  };

  /**
   * One pan for everything. Quick moves: sideways swipes the card, up sends it to the back, down
   * brings back the one that went there last. Press and keep still a moment first, then move:
   * the card lifts and is carried, to be dropped into My Tasks. Keep still longer: delete.
   */
  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    activeOffsetY: [-8, 8],
    onBegin: () => {
      'worklet';
      beganAt.set(Date.now());
      if (flip.value > 0.5 || landing.value > 0) return;
      // The lift says "you can carry it now"; holding on asks to delete it.
      if (canDrop) lifted.set(withDelay(HOLD_MS, withTiming(1, motion.press)));
      holding.set(0);
      holding.set(withDelay(DELETE_MS, withTiming(1, { duration: 0 }, (done) => { if (done && mode.value === IDLE) openDelete(); })));
    },
    onActivate: (e) => {
      'worklet';
      cancelAnimation(holding);
      holding.set(0);
      if (flip.value > 0.5 || landing.value > 0) { mode.set(IDLE); return; }
      const intent = intentOf(e.translationX, e.translationY, Date.now() - beganAt.value, canDrop);
      if (intent === 'drag') {
        mode.set(DRAG);
        detached.set(1);
        cancelAnimation(lifted);
        lifted.set(withTiming(1, motion.press));
        const m = measure(stackRef);
        if (m) origin.set({ x: m.pageX + m.width / 2, y: m.pageY + 52 + topHV.value / 2 });
        if (dropNow) dropNow.ready.set(withTiming(1, { duration: 160 }));
        scheduleOnRN(haptics.tick);
        return;
      }
      cancelAnimation(lifted);
      lifted.set(withTiming(0, motion.release));
      if (intent === 'swipe') {
        mode.set(SWIPE);
        detached.set(1);
        return;
      }
      mode.set(STEP);
      cancelAnimation(tilt);
      tilt.set(withSpring(1, STACK_SPRING));
    },
    onUpdate: (e) => {
      'worklet';
      const m = mode.value;
      if (m === STEP) {
        // Half the finger, like a rubber band; a lone card only gives a little.
        ty.set(e.translationY * (can.scroll ? RUBBER : 0.25));
        tx.set(e.translationX * 0.1);
        return;
      }
      if (m === SWIPE) {
        tx.set(e.translationX);
        ty.set(e.translationY * 0.3);
        const past = (can.right && e.translationX > THRESHOLD) || (can.left && e.translationX < -THRESHOLD) ? 1 : 0;
        if (past !== armed.value) { armed.set(past); if (past) scheduleOnRN(haptics.tick); }
        return;
      }
      if (m === DRAG) {
        tx.set(e.translationX);
        ty.set(e.translationY);
        if (!grab.value.set) {
          // Where on the card the finger is: the token gathers under the finger as it forms.
          grab.set({ x: e.absoluteX - e.translationX - origin.value.x, y: e.absoluteY - e.translationY - origin.value.y, set: 1 });
        }
        if (dropNow) {
          const top = dropNow.rect.value.y;
          const k = Math.max(0, Math.min(1, (e.absoluteY - (top - MORPH_FROM)) / (MORPH_FROM - MORPH_TO)));
          if (k === 1 && morph.value < 1) scheduleOnRN(haptics.tick);
          morph.set(k);
          // As the card leaves as a token, the next one moves up to the front (Figma 223:21789).
          if (n > 1) head.set(base.value + k);
        }
        const r = dropNow?.rect.value;
        const hovering = canDrop && r && isOver({ x: r.x, y: r.y - DROP_REACH, w: r.w, h: r.h + DROP_REACH }, e.absoluteX, e.absoluteY) ? 1 : 0;
        if (hovering !== over.value) {
          over.set(hovering);
          if (dropNow) dropNow.hot.set(withTiming(hovering, motion.release));
          if (hovering) scheduleOnRN(haptics.trade);
        }
      }
    },
    onDeactivate: (e) => {
      'worklet';
      const m = mode.value;
      mode.set(IDLE);
      armed.set(0);
      if (m === STEP) {
        const up = e.translationY < 0;
        if (can.scroll && stepCommits(e.translationY, e.velocityY, up ? -1 : 1)) return moveStack(up ? 1 : -1);
        return settle();
      }
      if (m === SWIPE) {
        if (can.right && (e.translationX > THRESHOLD || e.velocityX > FLING)) return fly('right');
        if (can.left && (e.translationX < -THRESHOLD || e.velocityX < -FLING)) return fly('left');
        return settle();
      }
      if (m === DRAG) {
        if (dropNow && dropCommits(morph.value, over.value > 0, e.velocityY)) { over.set(0); return land(); }
        over.set(0);
        if (dropNow) dropNow.hot.set(withTiming(0, motion.release));
        return settle();
      }
    },
    onFinalize: () => {
      'worklet';
      cancelAnimation(holding);
      // Cancelled mid-move (another gesture or the system took over): put the card back.
      if (mode.value !== IDLE) { mode.set(IDLE); armed.set(0); settle(); }
      if (dropNow) dropNow.ready.set(withTiming(0, { duration: 160 }));
      // A press that never became a carry puts the card back down.
      if (mode.value !== DRAG && landing.value === 0 && !detached.value) {
        cancelAnimation(lifted);
        lifted.set(withTiming(0, motion.release));
      }
    },
  });

  const tap = useTapGesture({
    maxDuration: HOLD_MS - 10,
    onActivate: () => {
      'worklet';
      if (deleting.value) return;
      flip.set(withTiming(flip.value > 0.5 ? 0 : 1, motion.flip));
      scheduleOnRN(haptics.tick);
    },
  });

  const gesture = useCompetingGestures(pan, tap);

  const closeDelete = () => {
    flip.set(withTiming(0, motion.flip, (done) => {
      if (!done) return;
      deleting.set(0);
      scheduleOnRN(setBack, 'story');
    }));
  };

  // Screen readers get the same moves without gestures.
  const stepBy = (by: -1 | 1) => {
    const target = base.value + by;
    leavePos.set(base.value);
    dir.set(by);
    base.set(target);
    moved(target);
    head.set(withSpring(target, STACK_SPRING));
  };

  if (!top) return null;

  // Bottom to top: the cards that left the front first (a card swiped up tucks beneath the rest),
  // then the far cards, then the front last (a card brought back down comes in over the others).
  const H = at.H;
  const window = n > 1 ? [H - 2, H - 1, H + 4, H + 3, H + 2, H + 1, H] : [H];
  const hand = { tx, ty, enter, flip, lifted, over, landing, detached, morph, tilt };
  const leave = { pos: leavePos, ty: leaveTy, tilt: leaveTilt, dir };

  const a11y = [
    actionsNow.right && `Swipe right: ${actionsNow.right.label}.`, actionsNow.left && `Swipe left: ${actionsNow.left.label}.`,
    can.scroll && 'Swipe up for the next card, down for the previous one.', dropNow && 'Press, then drag into My Deck to take it.',
    'Tap to flip.', onDelete && 'Hold to delete.',
  ].filter(Boolean).join(' ');

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={stackRef}
        onLayout={(e) => setStackW(Math.round(e.nativeEvent.layout.width))}
        style={[s.stack, { height: 52 + topH }]}
        accessibilityHint={a11y}
        accessibilityActions={can.scroll ? [{ name: 'next', label: 'Next card' }, { name: 'prev', label: 'Previous card' }] : []}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'next') stepBy(1); if (e.nativeEvent.actionName === 'prev') stepBy(-1); }}
      >
        {window.map((p) => {
          const card = cardAt(p);
          const front = p === H;
          return (
            <Layer
              key={`${p}:${card.id}`}
              pos={p}
              card={card}
              head={head}
              count={n}
              leave={leave}
              topHV={topHV}
              cardH={cardH}
              hand={front ? hand : undefined}
              back={front ? back : 'story'}
              answers={front ? answer?.(card) : undefined}
              footer={footer?.(card)}
              onUpdate={front && onUpdate ? () => onUpdate(card) : undefined}
              onDelete={front && onDelete ? () => onDelete(card) : undefined}
              onCancelDelete={front ? closeDelete : undefined}
              onHeight={front ? setTopH : undefined}
              stamps={front ? actionsNow : undefined}
              nudge={front ? topNudge : undefined}
            />
          );
        })}
        {dropNow && <Morph card={top} width={stackW} height={topH} hand={hand} grab={grab} />}
      </Animated.View>
    </GestureDetector>
  );
}

type HandValues = {
  tx: SharedValue<number>; ty: SharedValue<number>; enter: SharedValue<number>; flip: SharedValue<number>;
  lifted: SharedValue<number>; over: SharedValue<number>; landing: SharedValue<number>; detached: SharedValue<number>;
  morph: SharedValue<number>; tilt: SharedValue<number>;
};
/** The card that just left the front, and which way the stack moved. */
type LeaveValues = { pos: SharedValue<number>; ty: SharedValue<number>; tilt: SharedValue<number>; dir: SharedValue<number> };

/**
 * The carried card's silhouette as it turns into a circle: it starts as the card's own shape and
 * colors (so it takes over seamlessly as the card fades) and ends as the 80 round token.
 */
function Morph({ card, width, height, hand, grab }: { card: Card; width: number; height: number; hand: HandValues; grab: SharedValue<{ x: number; y: number; set: number }> }) {
  const t = useTheme();
  const s = useStyles();
  const spec = t.tones[toneFor(card)];
  const { tx, ty, morph, landing } = hand;

  // The card's own face, closing in on its middle: the outline shrinks to the pill's token, a
  // rounded square tilted -4deg (Figma 300:25413), while the colors and lights stay put behind it,
  // so it is the card itself becoming the token.
  const box = useAnimatedStyle(() => {
    const m = morph.value;
    const w = interpolate(m, [0, 1], [width, CIRCLE]);
    const h = interpolate(m, [0, 1], [height, CIRCLE]);
    return {
      opacity: interpolate(m, [0, 0.1], [0, 1], Extrapolation.CLAMP),
      width: w,
      height: h,
      left: width / 2 - w / 2,
      top: 52 + height / 2 - h / 2,
      borderRadius: interpolate(m, [0, 1], [24, TOKEN_R * (CIRCLE / TOKEN)]),
      transform: [
        { translateX: tx.value + grab.value.x * m },
        { translateY: ty.value + grab.value.y * m },
        { rotate: `${(tx.value / 18) * (1 - m) * (1 - landing.value) - 4 * m}deg` },
        { scale: 1 - landing.value * (1 - TOKEN / CIRCLE) },
      ],
    };
  });
  const face = useAnimatedStyle(() => {
    const m = morph.value;
    const w = interpolate(m, [0, 1], [width, CIRCLE]);
    const h = interpolate(m, [0, 1], [height, CIRCLE]);
    // Inside the 1.5 stroke, so offset by it.
    return { left: (w - width) / 2 - 1.5, top: (h - height) / 2 - 1.5 };
  });

  return (
    <Animated.View style={[s.morph, { backgroundColor: spec.card }, box]} pointerEvents="none">
      <Animated.View style={[s.face, { width, height, backgroundColor: spec.card }, face]}>
        <Blobs
          opacity={1}
          blobs={[
            { x: -13.5, y: -47.5, size: 152, blur: 0, sigma: 72, color: spec.cardGlow[0] },
            { x: 86.5, y: -138.87, size: 333, blur: 0, sigma: 140, color: spec.cardGlow[1] },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}

type LayerProps = {
  pos: number;
  card: Card;
  head: SharedValue<number>;
  count: number;
  leave: LeaveValues;
  topHV: SharedValue<number>;
  cardH: number;
  /** Only the front card gets the finger, the flip and its buttons. */
  hand?: HandValues;
  back: 'story' | 'delete';
  answers?: CardAnswers;
  footer?: ReactNode;
  onUpdate?: () => void;
  onDelete?: () => void;
  onCancelDelete?: () => void;
  onHeight?: (h: number) => void;
  stamps?: Partial<Record<Dir, SwipeAction>>;
  nudge?: CardNudge;
};

/** One card on the strip. Its place in the stack is pos - head; the front one also follows the finger. */
function Layer({ pos, card, head, count, leave, topHV, cardH, hand, back, answers, footer, onUpdate, onDelete, onCancelDelete, onHeight, stamps, nudge }: LayerProps) {
  const s = useStyles();
  const zero = useSharedValue(0);
  const one = useSharedValue(1);
  const tx = hand?.tx ?? zero;
  const ty = hand?.ty ?? zero;
  const enter = hand?.enter ?? one;
  const flip = hand?.flip ?? zero;
  const lifted = hand?.lifted ?? zero;
  const over = hand?.over ?? zero;
  const landing = hand?.landing ?? zero;
  const detached = hand?.detached ?? zero;
  const morph = hand?.morph ?? zero;
  const lift = hand?.tilt ?? zero;

  const level = useDerivedValue(() => (detached.value ? 0 : pos - head.value));
  const layer = useAnimatedStyle(() => {
    const p = pose(level.value, count, topHV.value, leave.dir.value);
    // The card that just left the front springs out of where the finger left it.
    const leaving = leave.pos.value === pos;
    const up = lift.value + (leaving ? leave.tilt.value : 0);
    const k = (1 + lifted.value * 0.03 + up * 0.05) * (1 - over.value * 0.25 * (morph.value > 0 ? 0 : 1)) * (1 - landing.value * 0.5);
    const swing = detached.value * (1 - landing.value);
    return {
      opacity: p.opacity * enter.value * (1 - interpolate(morph.value, [0, 0.12], [0, 1], Extrapolation.CLAMP)),
      transform: [
        { translateX: tx.value },
        { translateY: p.ty + ty.value + (leaving ? leave.ty.value : 0) },
        { rotate: `${p.rot + (tx.value / 18) * swing + up * 2}deg` },
        { scaleX: p.sx * k },
        { scaleY: p.sy * k },
      ],
    };
  });
  // The cards behind keep their own colours, dimmed 15% a place (the reference's brightness).
  const shade = useAnimatedStyle(() => ({ opacity: pose(level.value, count, topHV.value, leave.dir.value).dim }));
  const plate = useAnimatedStyle(() => ({ opacity: 1 - pose(level.value, count, topHV.value, leave.dir.value).shade }));
  const faces = {
    front: useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }] })),
    rear: useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }] })),
  };
  const fade = (on: boolean, v: number) => {
    'worklet';
    return { opacity: on && !landing.value && !over.value ? interpolate(v, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0 };
  };
  const stampRight = useAnimatedStyle(() => fade(!!stamps?.right, tx.value));
  const stampLeft = useAnimatedStyle(() => fade(!!stamps?.left, -tx.value));

  return (
    <Animated.View
      style={[s.layer, layer]}
      pointerEvents={hand ? 'box-none' : 'none'}
      accessibilityElementsHidden={!hand}
      importantForAccessibility={hand ? 'auto' : 'no-hide-descendants'}
      onLayout={onHeight ? (e) => onHeight(Math.round(e.nativeEvent.layout.height)) : undefined}
    >
      {/* The shadow lives here, so it can fade as the card moves back into the stack. */}
      <Animated.View style={[s.plate, s.hide, faces.front, plate]} />
      <Animated.View style={[s.plate, s.hide, faces.rear, plate]} />
      <DealCard
        card={card}
        flip={flip}
        back={back}
        answers={answers}
        footer={footer}
        shadow={false}
        minHeight={cardH}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onCancelDelete={onCancelDelete}
        nudge={nudge}
      />
      <Animated.View style={[s.shade, shade]} pointerEvents="none" />
      {stamps?.right && (
        <Animated.View style={[s.stamp, s.stampRight, stampRight]} pointerEvents="none">
          <Text variant="display/2xl" color={stamps.right.color} style={s.stampText}>{stamps.right.label}</Text>
        </Animated.View>
      )}
      {stamps?.left && (
        <Animated.View style={[s.stamp, s.stampLeft, stampLeft]} pointerEvents="none">
          <Text variant="display/2xl" color={stamps.left.color} style={s.stampText}>{stamps.left.label}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  // Full width between the screen's 20 margins (Figma: 350 on a 390 screen), whatever the phone.
  stack: { width: '100%', alignSelf: 'center' },
  // Figma 223:21908: 1.5 white stroke, shadow 0 25 50 -12 at 25% (Figma blur 50, spread -12).
  morph: {
    position: 'absolute', overflow: 'hidden', borderWidth: 1.5, borderColor: '#FFFFFF',
    boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)', zIndex: 10,
  },
  face: { position: 'absolute' },
  layer: { position: 'absolute', top: 52, left: 0, right: 0 },
  plate: { ...StyleSheet.absoluteFill, borderRadius: 24, backgroundColor: t.color.bg.raised, boxShadow: t.shadow.deal },
  hide: { backfaceVisibility: 'hidden' },
  // The cards waiting behind: a black dim over their own face (Figma 300:25117-8 keep the 1.5 white
  // stroke and the hairline ring, drawn on the card itself).
  shade: { ...StyleSheet.absoluteFill, borderRadius: 24, backgroundColor: '#000000' },
  stamp: { position: 'absolute', left: -8, right: -8, alignItems: 'center' },
  stampText: { textAlign: 'center', fontSize: 44, lineHeight: 46 },
  stampRight: { top: '40%', transform: [{ rotate: '-8deg' }] },
  stampLeft: { top: '40%', transform: [{ rotate: '8deg' }] },
}));
