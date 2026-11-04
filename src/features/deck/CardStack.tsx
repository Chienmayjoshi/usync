import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

import { type CardAnswers, DealCard } from './DealCard';
import { type Card, forMe } from './model';

export type Dir = 'left' | 'right' | 'up' | 'down';
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
  actions: Partial<Record<Dir, SwipeAction>>;
  drop?: DropTarget;
  /** Hold flips the card to "Delete task?". */
  onDelete?: (card: Card) => void;
  onUpdate?: (card: Card) => void;
  answer?: (card: Card) => CardAnswers | undefined;
  footer?: (card: Card) => ReactNode;
};

const THRESHOLD = 110;
const FLING = 900;

/** A stack of cards: only the top one is live; two more peek out above it. */
export function CardStack({ cards, actions, drop, onDelete, onUpdate, answer, footer }: Props) {
  const progress = useSharedValue(0);
  const s = useStyles();
  const [top, ...rest] = cards;
  return (
    <View style={s.stack}>
      {rest.slice(0, 2).reverse().map((c, i, arr) => <Behind key={c.id} level={arr.length - i} progress={progress} />)}
      {top && (
        <TopCard
          key={`${top.id}:${top.story.length}:${top.request ?? ''}`}
          card={top}
          progress={progress}
          actions={top.request && forMe(top) ? {} : actions}
          drop={forMe(top) ? undefined : drop}
          onDelete={onDelete}
          onUpdate={onUpdate}
          answers={answer?.(top)}
          footer={footer?.(top)}
        />
      )}
    </View>
  );
}

/** Cards waiting their turn peek out above the top one, each a shade darker. */
function Behind({ level, progress }: { level: number; progress: SharedValue<number> }) {
  const t = useTheme();
  const s = useStyles();
  const style = useAnimatedStyle(() => {
    const lvl = level - progress.value;
    return { transform: [{ translateY: -lvl * 16 }, { scale: 1 - lvl * 0.06 }] };
  });
  return <Animated.View style={[s.behind, { backgroundColor: level === 1 ? t.color.bg.stack1 : t.color.bg.stack2 }, style]} pointerEvents="none" />;
}

type TopProps = {
  card: Card;
  progress: SharedValue<number>;
  actions: Partial<Record<Dir, SwipeAction>>;
  drop?: DropTarget;
  onDelete?: (card: Card) => void;
  onUpdate?: (card: Card) => void;
  answers?: CardAnswers;
  footer?: ReactNode;
};

function TopCard({ card, progress, actions, drop, onDelete, onUpdate, answers, footer }: TopProps) {
  const s = useStyles();
  const tx = useSharedValue(0);
  const ty = useSharedValue(-40);
  const enter = useSharedValue(0);
  const flip = useSharedValue(0);
  const armed = useSharedValue(0);
  const over = useSharedValue(0);
  const landing = useSharedValue(0);
  const [back, setBack] = useState<'story' | 'delete'>('story');
  // Mirrors `back` for the gesture worklets.
  const deleting = useSharedValue(0);
  const can = { left: !!actions.left, right: !!actions.right, up: !!actions.up, down: !!actions.down };
  const canDrop = !!drop;

  useEffect(() => {
    // Deal in: the new top card settles onto the stack.
    progress.set(0);
    ty.set(withTiming(0, motion.dealIn));
    enter.set(withTiming(1, { duration: 180 }));
  }, [enter, progress, ty]);

  const finish = (dir: Dir) => actions[dir]?.run(card);
  const dropped = () => drop?.onDrop(card);

  const fly = (dir: Dir) => {
    'worklet';
    // Placeholder exit for "next" (up) until the reference animation arrives.
    const to = dir === 'up' ? { x: tx.value * 0.4, y: -900 } : dir === 'down' ? { x: tx.value, y: 900 } : { x: dir === 'right' ? 600 : -600, y: ty.value };
    progress.set(withTiming(1, motion.flyOut));
    ty.set(withTiming(to.y, motion.flyOut));
    tx.set(withTiming(to.x, motion.flyOut, (done) => { if (done) scheduleOnRN(finish, dir); }));
  };

  const land = () => {
    'worklet';
    // Into the tray: the card shrinks and sinks into the slot.
    progress.set(withTiming(1, { duration: 240 }));
    ty.set(withTiming(ty.value + 160, { duration: 240 }));
    landing.set(withTiming(1, { duration: 240 }, (done) => {
      if (!done) return;
      if (drop) drop.hot.set(withTiming(0, { duration: 200 }));
      scheduleOnRN(haptics.success);
      scheduleOnRN(dropped);
    }));
  };

  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    activeOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      if (drop) drop.ready.set(withTiming(1, { duration: 160 }));
    },
    onUpdate: (e) => {
      'worklet';
      if (flip.value > 0.5) return;
      tx.set(e.translationX);
      ty.set(e.translationY);
      progress.set(Math.min(1, Math.hypot(e.translationX, e.translationY) / 220));
      const hovering = canDrop && drop && isOver(drop.rect.value, e.absoluteX, e.absoluteY) ? 1 : 0;
      if (hovering !== over.value) {
        over.set(hovering);
        if (drop) drop.hot.set(withTiming(hovering, motion.release));
        if (hovering) scheduleOnRN(haptics.trade);
      }
      const past = !hovering && ((can.right && e.translationX > THRESHOLD) || (can.left && e.translationX < -THRESHOLD)
        || (can.up && e.translationY < -THRESHOLD) || (can.down && e.translationY > THRESHOLD)) ? 1 : 0;
      if (past !== armed.value) {
        armed.set(past);
        if (past) scheduleOnRN(haptics.tick);
      }
    },
    onFinalize: () => {
      'worklet';
      if (drop) drop.ready.set(withTiming(0, { duration: 160 }));
    },
    onDeactivate: (e) => {
      'worklet';
      armed.set(0);
      if (over.value) { over.set(0); return land(); }
      if (can.right && (e.translationX > THRESHOLD || e.velocityX > FLING)) return fly('right');
      if (can.left && (e.translationX < -THRESHOLD || e.velocityX < -FLING)) return fly('left');
      if (can.up && (e.translationY < -THRESHOLD || e.velocityY < -FLING)) return fly('up');
      if (can.down && (e.translationY > THRESHOLD || e.velocityY > FLING)) return fly('down');
      tx.set(withTiming(0, motion.cardBack));
      ty.set(withTiming(0, motion.cardBack));
      progress.set(withTiming(0, motion.cardBack));
    },
  });

  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      if (deleting.value) return;
      flip.set(withTiming(flip.value > 0.5 ? 0 : 1, motion.flip));
      scheduleOnRN(haptics.tick);
    },
  });

  const hold = useLongPressGesture({
    minDuration: 450,
    onActivate: () => {
      'worklet';
      if (!onDelete) return;
      deleting.set(1);
      scheduleOnRN(setBack, 'delete');
      scheduleOnRN(haptics.take);
      flip.set(withTiming(1, motion.flip));
    },
  });

  const gesture = useCompetingGestures(pan, hold, tap);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${(tx.value / 18) * (1 - landing.value)}deg` },
      { scale: (1 - over.value * 0.25) * (1 - landing.value * 0.5) },
    ],
  }));
  const calm = () => {
    'worklet';
    return 1 - Math.max(over.value, landing.value);
  };
  const fade = (on: boolean, v: number) => {
    'worklet';
    return { opacity: on ? calm() * interpolate(v, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0 };
  };
  const stamps = {
    right: useAnimatedStyle(() => fade(can.right, tx.value)),
    left: useAnimatedStyle(() => fade(can.left, -tx.value)),
    up: useAnimatedStyle(() => fade(can.up, -ty.value)),
    down: useAnimatedStyle(() => fade(can.down, ty.value)),
  };

  const closeDelete = () => {
    flip.set(withTiming(0, motion.flip, (done) => {
      if (!done) return;
      deleting.set(0);
      scheduleOnRN(setBack, 'story');
    }));
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[s.top, cardStyle]}
        accessibilityHint={[
          actions.right && `Swipe right: ${actions.right.label}.`, actions.left && `Swipe left: ${actions.left.label}.`,
          actions.up && `Swipe up: ${actions.up.label}.`, drop && 'Drag down into My Deck to take it.', 'Tap to flip.', onDelete && 'Hold to delete.',
        ].filter(Boolean).join(' ')}
      >
        <DealCard
          card={card}
          flip={flip}
          back={back}
          answers={answers}
          footer={footer}
          onUpdate={onUpdate ? () => onUpdate(card) : undefined}
          onDelete={onDelete ? () => onDelete(card) : undefined}
          onCancelDelete={closeDelete}
        />
        {(Object.keys(stamps) as Dir[]).map((dir) => actions[dir] && dir !== 'up' ? (
          <Animated.View key={dir} style={[s.stamp, dir === 'left' ? s.stampLeft : dir === 'right' ? s.stampRight : s.stampDown, stamps[dir]]} pointerEvents="none">
            <Text variant="display/2xl" color={actions[dir]!.color} style={s.stampText}>{actions[dir]!.label}</Text>
          </Animated.View>
        ) : null)}
      </Animated.View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((t) => ({
  stack: { paddingTop: 32 },
  top: { zIndex: 3 },
  behind: { position: 'absolute', left: 0, right: 0, top: 32, height: 120, borderRadius: t.radius.lg, zIndex: 1 },
  stamp: { position: 'absolute', left: -8, right: -8, alignItems: 'center' },
  stampText: { textAlign: 'center', fontSize: 44, lineHeight: 46 },
  stampRight: { top: '40%', transform: [{ rotate: '-8deg' }] },
  stampLeft: { top: '40%', transform: [{ rotate: '8deg' }] },
  stampDown: { top: '44%' },
}));
