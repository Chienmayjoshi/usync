import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  useLongPressGesture,
  usePanGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  interpolateColor,
  measure,
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
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

import { type CardAnswers, type CardNudge, DealCard, toneFor } from './DealCard';
import { type Card, forMe } from './model';

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
  /** Where the stack sits: the cards waiting behind take that surface's shades. */
  surface?: 'table' | 'drawer';
  /** A card to bring to the front ("id@time"), when sent here from Activity or a push. */
  focusId?: string;
};

const THRESHOLD = 110;
const FLING = 900;
/** A scroll commits past this share of a step, or on a flick faster than SCROLL_FLING. */
const COMMIT = 0.35;
const SCROLL_FLING = 700;
const LIFT_AFTER = 200;
const DELETE_AFTER = 450;

/**
 * Where a card sits for a given level: 0 is the front, 1 and 2 the tilted cards behind it
 * (Figma 223:21704-5: 302 x 259 tilted -2deg 23 from the top, then 254 x 200 tilted 2deg at 0), 3 is gone
 * behind them, and -1 is gone above: shrunk, lifted and faded, as in assets/deckscroll.mp4.
 * Offsets are from the front card's centre (300 tall, 52 from the top of the stack).
 */
const pose = (level: number, count: number) => {
  'worklet';
  if (level < 0) {
    const p = Math.min(1, -level);
    // The clip clears the leaving card early: it is gone by two thirds of the step.
    return { ty: -140 * p, sx: 1 - 0.12 * p, sy: 1 - 0.12 * p, rot: 0, opacity: interpolate(level, [-0.65, -0.1], [0, 1], Extrapolation.CLAMP), shade: 0 };
  }
  const l = Math.min(level, 2);
  return {
    ty: interpolate(l, [0, 1, 2], [0, -44.5, -98]),
    sx: interpolate(l, [0, 1, 2], [1, 302 / 350, 254 / 350]),
    sy: interpolate(l, [0, 1, 2], [1, 259 / 300, 200 / 300]),
    rot: interpolate(l, [0, 1, 2], [0, -2, 2]),
    // Three cards show at most, and never more than the stack holds: 1 card, no tilted ones.
    opacity: Math.min(interpolate(level, [2, 3], [1, 0], Extrapolation.CLAMP), interpolate(level, [count - 1, count], [1, 0], Extrapolation.CLAMP)),
    shade: interpolate(level, [0, 1], [0, 1], Extrapolation.CLAMP),
  };
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

// What the finger is doing with the top card.
const IDLE = 0;
const SCROLL = 1;
const SWIPE = 2;
const DRAG = 3;
/** Moving, axis not decided yet. */
const PICK = 4;

/**
 * A stack of cards. The top one is live; the next two wait behind it, tilted and shaded.
 *
 * Swipe up and the stack scrolls forward a card, down and the last one comes back, as in
 * assets/deckscroll.mp4. The stack is an endless strip of positions: position p shows
 * cards[(p - anchor) mod n], and `head` (on the UI thread) is where the front is. A swipe only
 * slides `head` one place; nothing is reordered, so there is nothing to snap back and no flicker.
 * Sideways swipes run `actions`; press, then drag, carries the top card into `drop`.
 */
export function CardStack({ cards, actions, drop, onDelete, onUpdate, answer, footer, surface = 'table', focusId }: Props) {
  const s = useStyles();
  const n = cards.length;
  const step = motion.stackScroll;

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
  const from = useSharedValue(at.H);

  // The finger on the top card.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const enter = useSharedValue(1);
  const flip = useSharedValue(0);
  const armed = useSharedValue(0);
  const over = useSharedValue(0);
  const landing = useSharedValue(0);
  const lifted = useSharedValue(0);
  /** Set the moment the press lifts the card (the lift itself animates). */
  const picked = useSharedValue(0);
  const mode = useSharedValue(IDLE);
  const holding = useSharedValue(0);
  /** 1 while the card is carried by hand (swipe or drag), so a scroll of the stack leaves it be. */
  const detached = useSharedValue(0);
  const deleting = useSharedValue(0);
  /** 0 card .. 1 circle, while carried toward the drop target. */
  const morph = useSharedValue(0);
  /** The front card's centre in the window as the drag began, and where the finger held it. */
  const origin = useSharedValue({ x: 0, y: 0 });
  const grab = useSharedValue({ x: 0, y: 0, set: 0 });
  const topHV = useSharedValue(300);
  const stackRef = useAnimatedRef<Animated.View>();
  const [back, setBack] = useState<'story' | 'delete'>('story');
  const [topH, setTopHState] = useState(300);
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

  const scrollBy = (dir: -1 | 1) => {
    'worklet';
    const target = base.value + dir;
    base.set(target);
    scheduleOnRN(moved, target);
    const left = Math.min(1, Math.abs(target - head.value));
    head.set(withTiming(target, { duration: Math.max(60, step.duration * left), easing: step.easing }));
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
    tx.set(withTiming(0, motion.cardBack));
    ty.set(withTiming(0, motion.cardBack, (done) => { if (done) detached.set(0); }));
    lifted.set(withTiming(0, motion.release));
    morph.set(withTiming(0, motion.cardBack));
    head.set(withTiming(base.value, motion.cardBack));
    grab.set({ x: 0, y: 0, set: 0 });
  };

  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    activeOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      cancelAnimation(holding);
      holding.set(0);
      if (flip.value > 0.5 || landing.value > 0) { mode.set(IDLE); return; }
      if (picked.value) {
        mode.set(DRAG);
        detached.set(1);
        const m = measure(stackRef);
        if (m) origin.set({ x: m.pageX + m.width / 2, y: m.pageY + 52 + topHV.value / 2 });
        if (dropNow) dropNow.ready.set(withTiming(1, { duration: 160 }));
        return;
      }
      mode.set(PICK);
    },
    onUpdate: (e) => {
      'worklet';
      if (mode.value === PICK) {
        // The first real movement decides: up or down scrolls the stack, sideways swipes the card.
        if (Math.abs(e.translationX) < 4 && Math.abs(e.translationY) < 4) return;
        const vertical = Math.abs(e.translationY) > Math.abs(e.translationX);
        mode.set(vertical ? SCROLL : SWIPE);
        if (vertical) {
          // Catch the stack where it is, even mid-step after a quick earlier swipe.
          cancelAnimation(head);
          from.set(head.value);
        } else {
          detached.set(1);
        }
      }
      const m = mode.value;
      if (m === SCROLL) {
        if (!can.scroll) { ty.set(e.translationY * 0.25); return; }
        const next = from.value - e.translationY / step.distance;
        head.set(Math.max(base.value - 1, Math.min(base.value + 1, next)));
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
          // Where on the card the finger is: the circle gathers under the finger as it forms.
          grab.set({ x: e.absoluteX - e.translationX - origin.value.x, y: e.absoluteY - e.translationY - origin.value.y, set: 1 });
        }
        if (dropNow) {
          const top = dropNow.rect.value.y;
          const k = Math.max(0, Math.min(1, (e.absoluteY - (top - MORPH_FROM)) / (MORPH_FROM - MORPH_TO)));
          if (k === 1 && morph.value < 1) scheduleOnRN(haptics.tick);
          morph.set(k);
          // As the card leaves as a circle, the next one moves up to the front (Figma 223:21789).
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
    onFinalize: () => {
      'worklet';
      if (dropNow) dropNow.ready.set(withTiming(0, { duration: 160 }));
    },
    onDeactivate: (e) => {
      'worklet';
      const m = mode.value;
      mode.set(IDLE);
      armed.set(0);
      if (m === SCROLL) {
        tx.set(withTiming(0, motion.cardBack));
        ty.set(withTiming(0, motion.cardBack));
        if (!can.scroll) return;
        const v = head.value - base.value;
        if (v > COMMIT || (v > 0 && e.velocityY < -SCROLL_FLING)) return scrollBy(1);
        if (v < -COMMIT || (v < 0 && e.velocityY > SCROLL_FLING)) return scrollBy(-1);
        head.set(withTiming(base.value, motion.cardBack));
        return;
      }
      if (m === SWIPE) {
        if (can.right && (e.translationX > THRESHOLD || e.velocityX > FLING)) return fly('right');
        if (can.left && (e.translationX < -THRESHOLD || e.velocityX < -FLING)) return fly('left');
        return settle();
      }
      if (m === DRAG) {
        picked.set(0);
        if (over.value) { over.set(0); return land(); }
        return settle();
      }
    },
  });

  const openDelete = () => {
    'worklet';
    if (!onDelete || flip.value > 0.5) return;
    deleting.set(1);
    lifted.set(withTiming(0, motion.release));
    scheduleOnRN(setBack, 'delete');
    scheduleOnRN(haptics.take);
    flip.set(withTiming(1, motion.flip));
  };

  // Press and keep still: the card lifts, ready to be carried. Keep holding and it asks to delete.
  const hold = useLongPressGesture({
    minDuration: LIFT_AFTER,
    maxDistance: 10,
    onActivate: () => {
      'worklet';
      if (flip.value > 0.5) return;
      picked.set(1);
      lifted.set(withTiming(1, motion.press));
      scheduleOnRN(haptics.tick);
      holding.set(0);
      holding.set(withDelay(DELETE_AFTER - LIFT_AFTER, withTiming(1, { duration: 0 }, (done) => { if (done && mode.value === IDLE) openDelete(); })));
    },
    onFinalize: () => {
      'worklet';
      cancelAnimation(holding);
      if (mode.value !== DRAG) picked.set(0);
      if (mode.value !== DRAG && !landing.value) lifted.set(withTiming(0, motion.release));
    },
  });

  const tap = useTapGesture({
    maxDuration: LIFT_AFTER - 10,
    onActivate: () => {
      'worklet';
      if (deleting.value) return;
      flip.set(withTiming(flip.value > 0.5 ? 0 : 1, motion.flip));
      scheduleOnRN(haptics.tick);
    },
  });

  const gesture = useCompetingGestures(useSimultaneousGestures(pan, hold), tap);

  const closeDelete = () => {
    flip.set(withTiming(0, motion.flip, (done) => {
      if (!done) return;
      deleting.set(0);
      scheduleOnRN(setBack, 'story');
    }));
  };

  // Screen readers get the same moves without gestures.
  const stepBy = (dir: -1 | 1) => {
    const target = base.value + dir;
    base.set(target);
    moved(target);
    head.set(withTiming(target, { duration: step.duration, easing: step.easing }));
  };

  if (!top) return null;

  // Behind to front: the far cards first, then the front, then the ones above it (leaving or
  // coming back), so a card on its way out always draws over the one rising under it.
  const H = at.H;
  const window = n > 1 ? [H + 4, H + 3, H + 2, H + 1, H, H - 1, H - 2] : [H];
  const hand = { tx, ty, enter, flip, lifted, over, landing, detached, morph };

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
              surface={surface}
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
  morph: SharedValue<number>;
};

/**
 * The carried card's silhouette as it turns into a circle: it starts as the card's own shape and
 * colors (so it takes over seamlessly as the card fades) and ends as the 80 round token.
 */
function Morph({ card, width, height, hand, grab }: { card: Card; width: number; height: number; hand: HandValues; grab: SharedValue<{ x: number; y: number; set: number }> }) {
  const t = useTheme();
  const s = useStyles();
  const spec = t.tones[toneFor(card)];
  const { tx, ty, morph, landing } = hand;

  // The card's own face, closing in on its middle: the outline shrinks and rounds to a circle
  // while the colors and lights stay put behind it, so it is the card itself becoming the circle.
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
      borderRadius: interpolate(m, [0, 1], [24, CIRCLE / 2]),
      transform: [
        { translateX: tx.value + grab.value.x * m },
        { translateY: ty.value + grab.value.y * m },
        { rotate: `${(tx.value / 18) * (1 - m) * (1 - landing.value)}deg` },
        { scale: 1 - landing.value * (1 - 32 / CIRCLE) },
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
  surface: 'table' | 'drawer';
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
function Layer({ pos, card, head, count, surface, hand, back, answers, footer, onUpdate, onDelete, onCancelDelete, onHeight, stamps, nudge }: LayerProps) {
  const t = useTheme();
  const s = useStyles();
  const shades = t.color.stack[surface];
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

  const level = useDerivedValue(() => (detached.value ? 0 : pos - head.value));
  const layer = useAnimatedStyle(() => {
    const p = pose(level.value, count);
    const k = (1 + lifted.value * 0.03) * (1 - over.value * 0.25 * (morph.value > 0 ? 0 : 1)) * (1 - landing.value * 0.5);
    const tilt = detached.value * (1 - landing.value);
    return {
      opacity: p.opacity * enter.value * (1 - interpolate(morph.value, [0, 0.12], [0, 1], Extrapolation.CLAMP)),
      transform: [
        { translateX: tx.value },
        { translateY: p.ty + ty.value },
        { rotate: `${p.rot + (tx.value / 18) * tilt}deg` },
        { scaleX: p.sx * k },
        { scaleY: p.sy * k },
      ],
    };
  });
  const shade = useAnimatedStyle(() => ({
    opacity: pose(level.value, count).shade,
    backgroundColor: interpolateColor(level.value, [1, 2], [shades[1], shades[0]]),
  }));
  const plate = useAnimatedStyle(() => ({ opacity: 1 - pose(level.value, count).shade }));
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
  // The cards waiting behind: plain plates with a 1.5 white stroke and a hairline ring (Figma 223:21704-5).
  shade: { ...StyleSheet.absoluteFill, borderRadius: 24, borderWidth: 1.5, borderColor: t.color.border.card, boxShadow: t.shadow.ring },
  stamp: { position: 'absolute', left: -8, right: -8, alignItems: 'center' },
  stampText: { textAlign: 'center', fontSize: 44, lineHeight: 46 },
  stampRight: { top: '40%', transform: [{ rotate: '-8deg' }] },
  stampLeft: { top: '40%', transform: [{ rotate: '8deg' }] },
}));
