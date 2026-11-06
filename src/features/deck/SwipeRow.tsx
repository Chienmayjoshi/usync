import { Image, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/theme/haptics';
import { ease, motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { type Mood } from '@/features/mascot/lines';
import { Mascot } from '@/features/mascot/Mascot';
import type { MascotRecipe } from '@/features/mascot/recipe';
import { bucketSticker } from '@/ui/DeckIcons';
import { PopButton } from '@/ui/PopButton';
import { Text } from '@/ui/Text';

import type { CardAnswers } from './DealCard';
import type { Card } from './model';

// Figma 232:22739: rows are 8 + 48.9 + 8 tall with 4 above and below to the hairline; the swipe
// block fills that whole 72 (239:22885). Content sits 12 past the block's edge.
export const ROW_H = 72.9;
const GAP = 12;
/** Past this share of the row the swipe commits (the block widens to take the row). */
const COMMIT = 0.45;
const FLING = 800;

type Props = {
  card: Card;
  first: boolean;
  onDone?: () => void;
  onLater?: () => void;
  onOpen: () => void;
  answers?: CardAnswers;
  answerLabels?: [string, string];
  /** The partner's mascot, when this card has sat long enough to be nudged. */
  nudge?: { mood: Mood; line: string; recipe: MascotRecipe | null; bg: string; ink: string };
};

/** A My Deck row: swipe right for DONE, left for LATER (back to the table). Tap for its story. */
export function SwipeRow({ card, first, onDone, onLater, onOpen, answers, answerLabels, nudge }: Props) {
  const t = useTheme();
  const s = useStyles();
  const tx = useSharedValue(0);
  const width = useSharedValue(350);
  const height = useSharedValue(1);
  const armed = useSharedValue(0);
  const sticker = bucketSticker(card.bucket);
  const meta = [card.bucket, card.effort, card.when].filter(Boolean).join('  ·  ');
  const swipes = !answers;

  const finish = (dir: 'done' | 'later') => {
    if (dir === 'done') onDone?.();
    else onLater?.();
  };

  const pan = usePanGesture({
    enabled: swipes,
    activeOffsetX: [-8, 8],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      let x = e.translationX;
      if (x > 0 && !onDone) x = 0;
      if (x < 0 && !onLater) x = 0;
      tx.set(x);
      const past = Math.abs(x) > width.value * COMMIT ? 1 : 0;
      if (past !== armed.value) { armed.set(past); if (past) scheduleOnRN(haptics.tick); }
    },
    onDeactivate: (e) => {
      'worklet';
      const x = tx.value;
      const right = onDone && (x > width.value * COMMIT || (x > 40 && e.velocityX > FLING));
      const left = onLater && (x < -width.value * COMMIT || (x < -40 && e.velocityX < -FLING));
      armed.set(0);
      if (right || left) {
        const dir = right ? 'done' : 'later';
        scheduleOnRN(dir === 'done' ? haptics.success : haptics.tick);
        tx.set(withTiming((right ? 1 : -1) * (width.value + GAP), { duration: 200, easing: ease.out }, (done) => {
          if (!done) return;
          height.set(withTiming(0, { duration: motion.layout, easing: ease.out }, (d) => { if (d) scheduleOnRN(finish, dir); }));
        }));
        return;
      }
      tx.set(withTiming(0, motion.release));
    },
  });

  const box = useAnimatedStyle(() => ({ height: ROW_H * height.value, opacity: height.value }));
  // The row gives way to the block: its text narrows and ellipsizes, as in Figma, rather than sliding off.
  const content = useAnimatedStyle(() => ({ left: Math.max(0, tx.value), right: Math.max(0, -tx.value) }));
  // The block grows with the finger, 12 behind the content's edge (Figma 239:22885 / 239:22889).
  const done = useAnimatedStyle(() => ({ width: Math.max(0, tx.value - GAP) }));
  const later = useAnimatedStyle(() => ({ width: Math.max(0, -tx.value - GAP) }));
  const label = (v: number) => {
    'worklet';
    return { opacity: interpolate(Math.abs(v), [40, 68], [0, 1], Extrapolation.CLAMP) };
  };
  const doneLabel = useAnimatedStyle(() => label(Math.max(0, tx.value)));
  const laterLabel = useAnimatedStyle(() => label(Math.min(0, tx.value)));

  return (
    <Animated.View style={[s.item, box]} onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      {!first && <View style={[s.line, { backgroundColor: t.color.border.subtle }]} />}
      <GestureDetector gesture={pan}>
        <View style={s.track}>
          <Animated.View style={[s.block, s.left, { backgroundColor: t.color.swipe.done }, done]}>
            <Animated.View style={doneLabel}><Text style={s.blockText} color={t.color.swipe.ink}>DONE</Text></Animated.View>
          </Animated.View>
          <Animated.View style={[s.block, s.right, { backgroundColor: t.color.swipe.later }, later]}>
            <Animated.View style={laterLabel}><Text style={s.blockText} color={t.color.swipe.ink}>LATER</Text></Animated.View>
          </Animated.View>
          <Animated.View style={[s.content, content]}>
            <Pressable onPress={onOpen} style={s.row} accessibilityRole="button" accessibilityHint="Opens this task's story" accessibilityActions={swipes ? [{ name: 'done', label: 'Done' }, { name: 'later', label: 'Later, back to the table' }] : []} onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'done') onDone?.(); if (e.nativeEvent.actionName === 'later') onLater?.(); }}>
              <View style={s.icon}>
                <Image source={sticker.src} style={{ width: sticker.w, height: sticker.h }} resizeMode="contain" />
              </View>
              <View style={s.copy}>
                <Text style={s.title} color={t.color.text.primary} numberOfLines={1}>{card.title}</Text>
                {nudge
                  ? <Text style={s.meta} color={nudge.ink} numberOfLines={1}>{nudge.line}</Text>
                  : <Text style={s.meta} color={t.color.text.secondary} numberOfLines={1}>{meta}</Text>}
              </View>
              {nudge && !answers && <Mascot recipe={nudge.recipe} mood={nudge.mood} size={28} bg={nudge.bg} />}
              {answers && answerLabels && (
                <View style={s.answers}>
                  <PopButton label={answerLabels[0]} tone="ghost" small onPress={answers.onDecline} />
                  <PopButton label={answerLabels[1]} tone="positive" small onPress={answers.onAccept} />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const useStyles = makeStyles(() => ({
  item: { overflow: 'hidden' },
  line: { height: 1 },
  track: { flex: 1, justifyContent: 'center' },
  block: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  left: { left: 0 },
  right: { right: 0 },
  blockText: { fontFamily: 'Satoshi-Black', fontSize: 14, lineHeight: 19 },
  content: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP, paddingVertical: 8 },
  icon: { width: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 16, lineHeight: 22 },
  // Figma gives the meta line a 22.9 box (title 22 + 4 + 22.9 = the 48.9 text column).
  meta: { fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 16, height: 22.9 },
  answers: { flexDirection: 'row', gap: 6 },
}));
