import { type ComponentRef, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAccount } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { theme, tones } from '@/theme/tokens';
import { Text } from '@/ui/Text';

import { CARD_DEPTH, DealCard, hintsFor, toneFor } from './DealCard';
import type { Card } from './model';
import { catchBounce, isOver, useTradeTarget } from './tradeTarget';

export type SwipeDir = 'left' | 'right' | 'up';

type Props = {
  cards: Card[];
  onSwipe: (card: Card, dir: SwipeDir) => void;
  onHold: (card: Card) => void;
};

const THRESHOLD = 110;
const FLING = 900;
const LAND = { duration: 260 };

type Origin = { x: number; y: number; w: number };

/** The deck: only the top card is live; up to two cards peek out behind it. */
export function SwipeDeck({ cards, onSwipe, onHold }: Props) {
  const progress = useSharedValue(0);
  // The deck's window position, so a card dropped on the partner avatar can fly into it.
  const origin = useSharedValue<Origin>({ x: 0, y: 0, w: 0 });
  const ref = useRef<ComponentRef<typeof View>>(null);
  const measure = () => ref.current?.measureInWindow((x, y, w) => origin.set({ x, y, w }));
  const [top, ...rest] = cards;
  return (
    <View ref={ref} onLayout={measure} collapsable={false} style={styles.deck}>
      {rest.slice(0, 2).reverse().map((c, i, arr) => (
        <BehindCard key={c.id} card={c} level={arr.length - i} progress={progress} />
      ))}
      {top && <TopCard key={`${top.id}:${top.story.length}`} card={top} progress={progress} origin={origin} onSwipe={onSwipe} onHold={onHold} />}
    </View>
  );
}

function BehindCard({ card, level, progress }: { card: Card; level: number; progress: SharedValue<number> }) {
  const tone = tones[toneFor(card)];
  const style = useAnimatedStyle(() => {
    // As the top card leaves, the cards behind rise one step.
    const lvl = level - progress.value;
    return { transform: [{ translateY: lvl * 12 }, { scale: 1 - lvl * 0.04 }], opacity: 1 - lvl * 0.25 };
  });
  return (
    <Animated.View style={[styles.behind, style]} pointerEvents="none">
      <View style={[styles.behindFace, { borderColor: tone.accent }]} />
      <View style={[styles.behindRight, { backgroundColor: tone.edge }]} />
      <View style={[styles.behindBottom, { backgroundColor: tone.edgeDeep }]} />
    </Animated.View>
  );
}

type TopProps = { card: Card; progress: SharedValue<number>; origin: SharedValue<Origin>; onSwipe: Props['onSwipe']; onHold: Props['onHold'] };

function TopCard({ card, progress, origin, onSwipe, onHold }: TopProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(-60);
  const enter = useSharedValue(0);
  const flip = useSharedValue(0);
  const armed = useSharedValue(0);
  const cardH = useSharedValue(0);
  const over = useSharedValue(0);
  const land = useSharedValue(0);
  const finger = useSharedValue({ x: 0, y: 0 });
  const target = useTradeTarget();
  const { partner } = useAccount();
  const hints = hintsFor(card, !partner);
  const canUp = hints.up !== null;
  const canLeft = hints.left !== null;
  // Only an untraded deal can be handed to Meera; after the one trade it goes to the table instead.
  const canGive = !!partner && card.status === 'deal' && !card.traded;

  useEffect(() => {
    // Deal in: the new top card drops onto the deck like a dealt card.
    progress.set(0);
    ty.set(withSpring(0, motion.dealIn));
    enter.set(withDelay(40, withTiming(1, { duration: 180 })));
  }, [enter, progress, ty]);

  const finish = (dir: SwipeDir) => onSwipe(card, dir);

  const fly = (dir: SwipeDir) => {
    'worklet';
    const to = dir === 'up' ? { x: tx.value, y: -900 } : { x: dir === 'right' ? 600 : -600, y: ty.value };
    progress.set(withTiming(1, motion.flyOut));
    ty.set(withTiming(to.y, motion.flyOut));
    tx.set(withTiming(to.x, motion.flyOut, (done) => {
      if (done) scheduleOnRN(finish, dir);
    }));
  };

  const give = () => {
    'worklet';
    // Fly the card's center into the avatar, shrinking as it goes, then the avatar catches it.
    const r = target.rect.value;
    const o = origin.value;
    progress.set(withTiming(1, LAND));
    tx.set(withTiming(r.x + r.w / 2 - (o.x + o.w / 2), LAND));
    ty.set(withTiming(r.y + r.h / 2 - (o.y + cardH.value / 2), LAND));
    land.set(withTiming(1, LAND, (done) => {
      if (!done) return;
      catchBounce(target.caught);
      target.hot.set(withTiming(0, { duration: 200 }));
      scheduleOnRN(haptics.success);
      scheduleOnRN(finish, 'left');
    }));
  };

  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    activeOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      if (canGive) target.ready.set(withTiming(1, { duration: 160 }));
    },
    onUpdate: (e) => {
      'worklet';
      tx.set(e.translationX);
      ty.set(e.translationY);
      progress.set(Math.min(1, Math.hypot(e.translationX, e.translationY) / 220));
      finger.set({ x: e.absoluteX, y: e.absoluteY });
      const hovering = canGive && isOver(target.rect.value, e.absoluteX, e.absoluteY) ? 1 : 0;
      if (hovering !== over.value) {
        over.set(hovering);
        target.hot.set(withSpring(hovering, motion.release));
        if (hovering) scheduleOnRN(haptics.trade);
      }
      const past = !hovering && (e.translationX > THRESHOLD || (canLeft && e.translationX < -THRESHOLD) || (canUp && e.translationY < -THRESHOLD)) ? 1 : 0;
      if (past !== armed.value) {
        armed.set(past);
        if (past) scheduleOnRN(haptics.tick);
      }
    },
    onFinalize: () => {
      'worklet';
      target.ready.set(withTiming(0, { duration: 160 }));
    },
    onDeactivate: (e) => {
      'worklet';
      armed.set(0);
      if (over.value) {
        over.set(0);
        return give();
      }
      if (e.translationX > THRESHOLD || e.velocityX > FLING) return fly('right');
      if (canLeft && (e.translationX < -THRESHOLD || e.velocityX < -FLING)) return fly('left');
      if (canUp && (e.translationY < -THRESHOLD || e.velocityY < -FLING)) return fly('up');
      tx.set(withSpring(0, motion.cardBack));
      ty.set(withSpring(0, motion.cardBack));
      progress.set(withSpring(0, motion.cardBack));
    },
  });

  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      flip.set(withTiming(flip.value > 0.5 ? 0 : 1, motion.flip));
      scheduleOnRN(haptics.tick);
    },
  });

  const hold = useLongPressGesture({
    minDuration: 450,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onHold, card);
    },
  });

  const gesture = useCompetingGestures(pan, hold, tap);

  const cardStyle = useAnimatedStyle(() => {
    // Over the avatar the card shrinks and straightens, like a card being handed over.
    // It also hangs below and left of the finger so Meera's avatar stays in view.
    const hot = over.value || land.value ? target.hot.value : 0;
    const lift = hot * (1 - land.value);
    const o = origin.value;
    const cx = o.x + o.w / 2 + tx.value;
    const cy = o.y + cardH.value / 2 + ty.value;
    const scale = (1 - hot * 0.62) * (1 - land.value * 0.9);
    return {
      opacity: enter.value * (1 - land.value * 0.6),
      transform: [
        { translateX: tx.value + (finger.value.x - 90 - cx) * lift },
        { translateY: ty.value + (finger.value.y + 90 - cy) * lift },
        { rotate: `${(tx.value / 18) * (1 - hot)}deg` },
        { scale },
      ],
    };
  });
  // Direction stamps step aside while the card hovers over the avatar.
  const calm = () => {
    'worklet';
    return 1 - Math.max(over.value, land.value);
  };
  const rightStamp = useAnimatedStyle(() => ({ opacity: calm() * interpolate(tx.value, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const leftStamp = useAnimatedStyle(() => ({ opacity: !canLeft ? 0 : calm() * interpolate(tx.value, [-20, -THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const upStamp = useAnimatedStyle(() => ({ opacity: canUp ? calm() * interpolate(ty.value, [-20, -THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0 }));

  const accent = tones[toneFor(card)].accent;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.top, cardStyle]}
        onLayout={(e) => cardH.set(e.nativeEvent.layout.height)}
        accessibilityHint={`Swipe right, left or up.${canGive ? ' Drag onto your partner to hand it over.' : ''} Tap to flip. Hold to update.`}
      >
        <DealCard card={card} flip={flip} />
        <Animated.View style={[styles.stamp, styles.stampRight, { borderColor: accent }, rightStamp]} pointerEvents="none">
          <Text variant="label/md" color={accent}>{hints.right}</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampLeft, leftStamp]} pointerEvents="none">
          <Text variant="label/md" color={theme.color.text.secondary}>{hints.left}</Text>
        </Animated.View>
        {canUp && (
          <Animated.View style={[styles.stamp, styles.stampUp, upStamp]} pointerEvents="none">
            <Text variant="label/md" color={theme.color.together.base}>{hints.up}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  deck: { minHeight: 340, paddingBottom: 28 },
  top: { zIndex: 3 },
  behind: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 28, zIndex: 1 },
  behindFace: { position: 'absolute', left: 0, top: 0, right: CARD_DEPTH, bottom: CARD_DEPTH, backgroundColor: theme.color.bg.raised, borderWidth: 1.5 },
  behindRight: { position: 'absolute', right: 0, top: CARD_DEPTH, bottom: 0, width: CARD_DEPTH },
  behindBottom: { position: 'absolute', left: CARD_DEPTH, right: 0, bottom: 0, height: CARD_DEPTH },
  stamp: { position: 'absolute', borderWidth: 2, borderColor: theme.color.text.secondary, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.color.bg.canvas },
  stampRight: { top: 28, left: 24, transform: [{ rotate: '-8deg' }] },
  stampLeft: { top: 28, right: 30, transform: [{ rotate: '8deg' }] },
  stampUp: { bottom: 40, alignSelf: 'center', borderColor: theme.color.together.base },
});
