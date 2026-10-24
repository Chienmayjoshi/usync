import { useEffect } from 'react';
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

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { theme, tones } from '@/theme/tokens';
import { Text } from '@/ui/Text';

import { CARD_DEPTH, DealCard, hintsFor, toneFor } from './DealCard';
import type { Card } from './model';

export type SwipeDir = 'left' | 'right' | 'up';

type Props = {
  cards: Card[];
  onSwipe: (card: Card, dir: SwipeDir) => void;
  onHold: (card: Card) => void;
};

const THRESHOLD = 110;
const FLING = 900;

/** The deck: only the top card is live; up to two cards peek out behind it. */
export function SwipeDeck({ cards, onSwipe, onHold }: Props) {
  const progress = useSharedValue(0);
  const [top, ...rest] = cards;
  return (
    <View style={styles.deck}>
      {rest.slice(0, 2).reverse().map((c, i, arr) => (
        <BehindCard key={c.id} card={c} level={arr.length - i} progress={progress} />
      ))}
      {top && <TopCard key={`${top.id}:${top.story.length}`} card={top} progress={progress} onSwipe={onSwipe} onHold={onHold} />}
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

function TopCard({ card, progress, onSwipe, onHold }: { card: Card; progress: SharedValue<number>; onSwipe: Props['onSwipe']; onHold: Props['onHold'] }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(-60);
  const enter = useSharedValue(0);
  const flip = useSharedValue(0);
  const armed = useSharedValue(0);
  const hints = hintsFor(card);
  const canUp = hints.up !== null;

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

  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      tx.set(e.translationX);
      ty.set(e.translationY);
      progress.set(Math.min(1, Math.hypot(e.translationX, e.translationY) / 220));
      const over = Math.abs(e.translationX) > THRESHOLD || (canUp && e.translationY < -THRESHOLD) ? 1 : 0;
      if (over !== armed.value) {
        armed.set(over);
        if (over) scheduleOnRN(haptics.tick);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      armed.set(0);
      if (e.translationX > THRESHOLD || e.velocityX > FLING) return fly('right');
      if (e.translationX < -THRESHOLD || e.velocityX < -FLING) return fly('left');
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

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${tx.value / 18}deg` }],
  }));
  const rightStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const leftStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-20, -THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const upStamp = useAnimatedStyle(() => ({ opacity: canUp ? interpolate(ty.value, [-20, -THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0 }));

  const accent = tones[toneFor(card)].accent;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.top, cardStyle]} accessibilityHint="Swipe right, left or up. Tap to flip. Hold to update.">
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
