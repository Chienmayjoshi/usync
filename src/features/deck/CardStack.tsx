import { type ReactNode, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

import { type CardAnswers, DealCard } from './DealCard';
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
  onDrop: (card: Card) => void;
};

export const isOver = (r: Rect, x: number, y: number) => {
  'worklet';
  return x >= r.x && x <= r.x + r.w && y >= r.y - 24 && y <= r.y + r.h;
};

type Props = {
  cards: Card[];
  /** Horizontal swipes: what right and left do with the top card. */
  actions: Partial<Record<Dir, SwipeAction>>;
  /** Swipe up: this card goes to the back and the next one comes forward. */
  onNext?: (card: Card) => void;
  /** Swipe down: the card at the back (passed in) returns to the front. */
  onPrev?: (card: Card) => void;
  /** Press, then drag the card here to take it. */
  drop?: DropTarget;
  /** Hold flips the card to "Delete task?". */
  onDelete?: (card: Card) => void;
  onUpdate?: (card: Card) => void;
  answer?: (card: Card) => CardAnswers | undefined;
  footer?: (card: Card) => ReactNode;
  /** Where the stack sits: the cards waiting behind take that surface's shades. */
  surface?: 'table' | 'drawer';
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
 * (Figma: 302 x 259 tilted -2deg 26 from the top, then 254 x 200 tilted 2deg at 4), 3 is gone
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
    ty: interpolate(l, [0, 1, 2], [0, -46.5, -98]),
    sx: interpolate(l, [0, 1, 2], [1, 302 / 350, 254 / 350]),
    sy: interpolate(l, [0, 1, 2], [1, 259 / 300, 200 / 300]),
    rot: interpolate(l, [0, 1, 2], [0, -2, 2]),
    // Three cards show at most, and never more than the stack holds: 1 card, no tilted ones.
    opacity: Math.min(interpolate(level, [2, 3], [1, 0], Extrapolation.CLAMP), interpolate(level, [count - 1, count], [1, 0], Extrapolation.CLAMP)),
    shade: interpolate(level, [0, 1], [0, 1], Extrapolation.CLAMP),
  };
};

/**
 * A stack of cards. The top one is live; the next two wait behind it, tilted and shaded.
 * Swipe up and the stack scrolls forward a card, down and the last one comes back. The scroll
 * follows the finger and finishes with motion.stackScroll. Sideways swipes run `actions`;
 * press, then drag, carries the top card into `drop`.
 */
export function CardStack({ cards, actions, onNext, onPrev, drop, onDelete, onUpdate, answer, footer, surface = 'table' }: Props) {
  const s = useStyles();
  /** -1..1 of a step: negative scrolls forward (up), positive back (down). */
  const scroll = useSharedValue(0);
  /** 1 once a gesture has moved the stack and the next render should land without a deal-in. */
  const pending = useSharedValue(0);
  const n = cards.length;
  const [top] = cards;
  const at = (i: number) => cards[((i % n) + n) % n];
  const order = cards.map((c) => c.id).join(',');

  // The cards now match where the gesture left the stack: put the scroll back to rest.
  useLayoutEffect(() => {
    if (pending.value) { pending.set(0); scroll.set(0); }
  }, [order, pending, scroll]);

  return (
    <View style={s.stack}>
      {/* Back to front, so nearer cards draw over further ones. Slots repeat the deck as a loop. */}
      {n > 1 && [3, 2, 1].map((i) => <Peek key={i} slot={i} card={at(i)} scroll={scroll} count={n} surface={surface} />)}
      {top && (
        <TopCard
          key={`${top.id}:${top.story.length}:${top.request ?? ''}`}
          card={top}
          last={n > 1 ? at(-1) : undefined}
          count={n}
          scroll={scroll}
          pending={pending}
          surface={surface}
          // A request waits on an answer, but you can still look past it.
          actions={top.request && forMe(top) ? {} : actions}
          onNext={onNext}
          onPrev={onPrev}
          drop={forMe(top) ? undefined : drop}
          onDelete={onDelete}
          onUpdate={onUpdate}
          answers={answer?.(top)}
          footer={footer?.(top)}
        />
      )}
      {/* The card coming back from above on a swipe down. */}
      {n > 1 && <Peek key={-1} above slot={-1} card={at(-1)} scroll={scroll} count={n} surface={surface} />}
    </View>
  );
}

type Hand = { tx: SharedValue<number>; ty: SharedValue<number>; k: SharedValue<number>; enter: SharedValue<number>; still: SharedValue<number> };

/**
 * Pose, shade and shadow for one layer. Every shared value is read directly in the style worklets
 * (not through a helper), so Reanimated sees them as inputs and re-runs the styles as they change.
 */
function useLayerStyles(level: SharedValue<number>, count: number, surface: 'table' | 'drawer', hand?: Hand) {
  const t = useTheme();
  const shades = t.color.stack[surface];
  const zero = useSharedValue(0);
  const one = useSharedValue(1);
  const tx = hand?.tx ?? zero;
  const ty = hand?.ty ?? zero;
  const k = hand?.k ?? one;
  const enter = hand?.enter ?? one;
  const still = hand?.still ?? zero;
  const layer = useAnimatedStyle(() => {
    const p = pose(level.value, count);
    // The top card also follows the finger: sideways swipes tilt it, a lift grows it a touch.
    return {
      opacity: p.opacity * enter.value,
      transform: [
        { translateX: tx.value },
        { translateY: p.ty + ty.value },
        { rotate: `${p.rot + (tx.value / 18) * still.value}deg` },
        { scaleX: p.sx * k.value },
        { scaleY: p.sy * k.value },
      ],
    };
  });
  const shade = useAnimatedStyle(() => ({
    opacity: pose(level.value, count).shade,
    backgroundColor: interpolateColor(level.value, [1, 2], [shades[1], shades[0]]),
  }));
  const plate = useAnimatedStyle(() => ({ opacity: 1 - pose(level.value, count).shade }));
  return { layer, shade, plate };
}

/** A card waiting behind the top one (or above it, on its way back). Looks only. */
function Peek({ slot, card, scroll, count, surface, above }: { slot: number; card: Card; scroll: SharedValue<number>; count: number; surface: 'table' | 'drawer'; above?: boolean }) {
  const s = useStyles();
  const flip = useSharedValue(0);
  const level = useDerivedValue(() => slot + scroll.value);
  const { layer, shade, plate } = useLayerStyles(level, count, surface);
  return (
    <Animated.View style={[s.peek, above && s.above, layer]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[s.plate, plate]} />
      <DealCard card={card} flip={flip} shadow={false} />
      <Animated.View style={[s.shade, shade]} />
    </Animated.View>
  );
}

type TopProps = {
  card: Card;
  /** The card at the back, which a swipe down brings forward. */
  last?: Card;
  count: number;
  scroll: SharedValue<number>;
  pending: SharedValue<number>;
  surface: 'table' | 'drawer';
  actions: Partial<Record<Dir, SwipeAction>>;
  onNext?: (card: Card) => void;
  onPrev?: (card: Card) => void;
  drop?: DropTarget;
  onDelete?: (card: Card) => void;
  onUpdate?: (card: Card) => void;
  answers?: CardAnswers;
  footer?: ReactNode;
};

// What the finger is doing with the top card.
const IDLE = 0;
const SCROLL = 1;
const SWIPE = 2;
const DRAG = 3;
/** Moving, axis not decided yet. */
const PICK = 4;

function TopCard({ card, last, count, scroll, pending, surface, actions, onNext, onPrev, drop, onDelete, onUpdate, answers, footer }: TopProps) {
  const s = useStyles();
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
  const [back, setBack] = useState<'story' | 'delete'>('story');
  // Mirrors `back` for the gesture worklets.
  const deleting = useSharedValue(0);
  const can = { left: !!actions.left, right: !!actions.right, next: !!onNext && count > 1, prev: !!onPrev && !!last && count > 1 };
  const canDrop = !!drop;
  const step = motion.stackScroll;

  useLayoutEffect(() => {
    // Arrived by a scroll or a swipe: the stack already put this card in front. Otherwise deal it in.
    if (pending.value) return;
    ty.set(-40);
    enter.set(0);
    ty.set(withTiming(0, motion.dealIn));
    enter.set(withTiming(1, { duration: 180 }));
  }, [enter, pending, ty]);

  const finish = (dir: Dir) => actions[dir]?.run(card);
  const dropped = () => drop?.onDrop(card);
  const next = () => onNext?.(card);
  const prev = () => { if (last) onPrev?.(last); };

  const fly = (dir: Dir) => {
    'worklet';
    // Off to the side while the stack moves up a place behind it.
    pending.set(1);
    scroll.set(withTiming(-1, motion.flyOut));
    tx.set(withTiming(dir === 'right' ? 600 : -600, motion.flyOut, (done) => { if (done) scheduleOnRN(finish, dir); }));
  };

  const land = () => {
    'worklet';
    // Into the tray: the card shrinks and sinks into the slot.
    pending.set(1);
    scroll.set(withTiming(-1, { duration: 240 }));
    ty.set(withTiming(ty.value + 160, { duration: 240 }));
    landing.set(withTiming(1, { duration: 240 }, (done) => {
      if (!done) return;
      if (drop) drop.hot.set(withTiming(0, { duration: 200 }));
      scheduleOnRN(haptics.success);
      scheduleOnRN(dropped);
    }));
  };

  const settle = () => {
    'worklet';
    tx.set(withTiming(0, motion.cardBack));
    ty.set(withTiming(0, motion.cardBack, (done) => { if (done) detached.set(0); }));
    lifted.set(withTiming(0, motion.release));
  };

  const scrollTo = (dir: -1 | 1) => {
    'worklet';
    // Finish the step from wherever the finger let go, in the time the rest of it deserves.
    pending.set(1);
    const left = 1 - Math.abs(scroll.value);
    scroll.set(withTiming(dir, { duration: Math.max(60, step.duration * left), easing: step.easing }, (done) => {
      if (!done) return;
      scheduleOnRN(haptics.tick);
      scheduleOnRN(dir < 0 ? next : prev);
    }));
  };

  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    activeOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      cancelAnimation(holding);
      holding.set(0);
      if (flip.value > 0.5) { mode.set(IDLE); return; }
      if (picked.value) {
        mode.set(DRAG);
        detached.set(1);
        if (drop) drop.ready.set(withTiming(1, { duration: 160 }));
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
        if (!vertical) detached.set(1);
      }
      const m = mode.value;
      if (m === SCROLL) {
        const v = -e.translationY / step.distance;
        // Only one card: nowhere to go, so it gives a little and comes back.
        if ((v > 0 && !can.next) || (v < 0 && !can.prev)) { scroll.set(0); ty.set(e.translationY * 0.25); return; }
        scroll.set(Math.max(-1, Math.min(1, -v)));
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
        const hovering = canDrop && drop && isOver(drop.rect.value, e.absoluteX, e.absoluteY) ? 1 : 0;
        if (hovering !== over.value) {
          over.set(hovering);
          if (drop) drop.hot.set(withTiming(hovering, motion.release));
          if (hovering) scheduleOnRN(haptics.trade);
        }
      }
    },
    onFinalize: () => {
      'worklet';
      if (drop) drop.ready.set(withTiming(0, { duration: 160 }));
    },
    onDeactivate: (e) => {
      'worklet';
      const m = mode.value;
      mode.set(IDLE);
      armed.set(0);
      if (m === SCROLL) {
        tx.set(withTiming(0, motion.cardBack));
        ty.set(withTiming(0, motion.cardBack));
        const v = scroll.value;
        if (can.next && (v < -COMMIT || (v < 0 && e.velocityY < -SCROLL_FLING))) return scrollTo(-1);
        if (can.prev && (v > COMMIT || (v > 0 && e.velocityY > SCROLL_FLING))) return scrollTo(1);
        scroll.set(withTiming(0, motion.cardBack));
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

  const still = useDerivedValue(() => detached.value * (1 - landing.value));
  // Only a scroll moves the front card through the stack; a swipe or drag carries it by hand.
  const level = useDerivedValue(() => (detached.value ? 0 : scroll.value));
  const k = useDerivedValue(() => (1 + lifted.value * 0.03) * (1 - over.value * 0.25) * (1 - landing.value * 0.5));
  const { layer, shade, plate } = useLayerStyles(level, count, surface, { tx, ty, k, enter, still });
  const calm = () => {
    'worklet';
    return 1 - Math.max(over.value, landing.value);
  };
  const fade = (on: boolean, v: number) => {
    'worklet';
    return { opacity: on && mode.value !== DRAG ? calm() * interpolate(v, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0 };
  };
  const stamps = {
    right: useAnimatedStyle(() => fade(can.right, tx.value)),
    left: useAnimatedStyle(() => fade(can.left, -tx.value)),
  };
  const faces = {
    front: useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }] })),
    rear: useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }] })),
  };

  const closeDelete = () => {
    flip.set(withTiming(0, motion.flip, (done) => {
      if (!done) return;
      deleting.set(0);
      scheduleOnRN(setBack, 'story');
    }));
  };

  const a11y = [
    actions.right && `Swipe right: ${actions.right.label}.`, actions.left && `Swipe left: ${actions.left.label}.`,
    can.next && 'Swipe up for the next card, down for the previous one.', drop && 'Press, then drag into My Deck to take it.',
    'Tap to flip.', onDelete && 'Hold to delete.',
  ].filter(Boolean).join(' ');

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[s.top, layer]}
        accessibilityHint={a11y}
        accessibilityActions={[...(can.next ? [{ name: 'next', label: 'Next card' }] : []), ...(can.prev ? [{ name: 'prev', label: 'Previous card' }] : [])]}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'next') next(); if (e.nativeEvent.actionName === 'prev') prev(); }}
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
          onUpdate={onUpdate ? () => onUpdate(card) : undefined}
          onDelete={onDelete ? () => onDelete(card) : undefined}
          onCancelDelete={closeDelete}
        />
        <Animated.View style={[s.shade, shade]} pointerEvents="none" />
        {(['right', 'left'] as const).map((dir) => actions[dir] ? (
          <Animated.View key={dir} style={[s.stamp, dir === 'left' ? s.stampLeft : s.stampRight, stamps[dir]]} pointerEvents="none">
            <Text variant="display/2xl" color={actions[dir]!.color} style={s.stampText}>{actions[dir]!.label}</Text>
          </Animated.View>
        ) : null)}
      </Animated.View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((t) => ({
  stack: { paddingTop: 52, width: '100%', maxWidth: 350, alignSelf: 'center' },
  top: { zIndex: 3 },
  peek: { position: 'absolute', top: 52, left: 0, right: 0, zIndex: 1 },
  above: { zIndex: 4 },
  plate: { ...StyleSheet.absoluteFill, borderRadius: 24, backgroundColor: t.color.bg.raised, boxShadow: t.shadow.float },
  hide: { backfaceVisibility: 'hidden' },
  shade: { ...StyleSheet.absoluteFill, borderRadius: 24, borderWidth: 1, borderColor: t.color.border.card },
  stamp: { position: 'absolute', left: -8, right: -8, alignItems: 'center' },
  stampText: { textAlign: 'center', fontSize: 44, lineHeight: 46 },
  stampRight: { top: '40%', transform: [{ rotate: '-8deg' }] },
  stampLeft: { top: '40%', transform: [{ rotate: '8deg' }] },
}));
