import { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { ease, motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { type Mood } from '@/features/mascot/lines';
import type { MascotRecipe } from '@/features/mascot/recipe';
import { bucketSticker } from '@/ui/DeckIcons';
import { PopButton } from '@/ui/PopButton';
import { Text } from '@/ui/Text';

import type { CardAnswers } from './DealCard';
import { toneFor } from './taskTone';
import type { Card } from './model';

// Figma 232:22739: rows are 8 + 48.9 + 8 tall with 4 above and below to the hairline; the swipe
// block fills that whole 72 (239:22885). Content sits 12 past the block's edge.
export const ROW_H = 72.9;
const GAP = 12;
const PANEL_INSET = 4;
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
  /** A line in place of the meta: who asked what, or who this is waiting on. */
  note?: { text: string; ink: string };
  /** The words on the swipe blocks (a surprise says REVEAL and +1 DAY). */
  labels?: { done: string; later: string };
  /** The left swipe changes the card without taking it off the deck: the row springs back. */
  laterStays?: boolean;
  /** Set (to a fresh key) when this row was asked for: it lights up once, "here it is". */
  lit?: string | null;
};

/** A My Deck row: swipe right for DONE, left for LATER (back to the table). Tap for its story. */
export function SwipeRow({ card, onDone, onLater, onOpen, answers, answerLabels, nudge, note, labels, laterStays, lit }: Props) {
  const t = useTheme();
  const names = useNames();
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
        if (!right && laterStays) {
          // Past the line: the change is made, and the row comes home with the finger's speed.
          scheduleOnRN(finish, dir);
          tx.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: e.velocityX }));
          return;
        }
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

  // A one time "here it is": the row glows and fades out over most of a second (ease-out, no loop).
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!lit) return;
    glow.set(1);
    glow.set(withDelay(250, withTiming(0, { duration: 900, easing: ease.out })));
  }, [lit, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() * 0.55 }));
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
      <GestureDetector gesture={pan}>
        <View style={s.track}>
          <Animated.View style={[s.block, s.left, { backgroundColor: t.color.swipe.done }, done]}>
            <Animated.View style={doneLabel}><Text style={s.blockText} color={t.color.swipe.ink}>{labels?.done ?? 'DONE'}</Text></Animated.View>
          </Animated.View>
          <Animated.View style={[s.block, s.right, { backgroundColor: t.color.swipe.later }, later]}>
            <Animated.View style={laterLabel}><Text style={s.blockText} color={t.color.swipe.ink}>{labels?.later ?? 'LATER'}</Text></Animated.View>
          </Animated.View>
          <Animated.View style={[s.content, { backgroundColor: t.tones[toneFor(card)].wash }, content]}>
            <Pressable onPress={onOpen} style={s.row} accessibilityRole="button" accessibilityHint="Opens this task's story" accessibilityActions={swipes ? [{ name: 'done', label: labels ? 'Reveal' : 'Done' }, { name: 'later', label: labels ? 'Reveal a day later' : 'Later, back to the table' }] : []} onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'done') onDone?.(); if (e.nativeEvent.actionName === 'later') onLater?.(); }}>
              <View style={s.icon}>
                <Image source={sticker.src} style={{ width: sticker.w, height: sticker.h }} resizeMode="contain" />
              </View>
              <View style={s.copy}>
                <Text style={s.title} color={t.color.text.primary} numberOfLines={1}>{card.title}</Text>
                {note
                  ? <Text style={s.meta} color={note.ink} numberOfLines={1}>{note.text}</Text>
                  : nudge
                  ? <Text style={s.meta} color={nudge.ink} numberOfLines={1}>{nudge.line}</Text>
                  : <Text style={s.meta} color={t.color.text.secondary} numberOfLines={1}>{meta}</Text>}
              </View>
              {/* No face per row: the deck's one mascot speaks for it above the list (DeckMascot). */}
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
      {/* Over the row, see-through: the light passes over it without hiding the words. */}
      <Animated.View pointerEvents="none" style={[s.glow, { backgroundColor: t.tones[names.colors.partner].glow[0] }, glowStyle]} />
    </Animated.View>
  );
}

const useStyles = makeStyles(() => ({
  item: { overflow: 'hidden' },
  glow: { position: 'absolute', left: -8, right: -8, top: 4, bottom: 4, borderRadius: 14 },
  track: { flex: 1, justifyContent: 'center' },
  // Rows are panels now, 4 in from top and bottom; the swipe blocks match them.
  block: { position: 'absolute', top: PANEL_INSET, bottom: PANEL_INSET, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  left: { left: 0 },
  right: { right: 0 },
  blockText: { fontFamily: 'Satoshi-Black', fontSize: 14, lineHeight: 19 },
  // The task's own colour, washed out: the same task as its Table card (0012).
  content: { position: 'absolute', top: PANEL_INSET, bottom: PANEL_INSET, borderRadius: 14, paddingHorizontal: 12, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP, paddingVertical: 8 },
  icon: { width: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 16, lineHeight: 22 },
  // Figma gives the meta line a 22.9 box (title 22 + 4 + 22.9 = the 48.9 text column).
  meta: { fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 16, height: 22.9 },
  answers: { flexDirection: 'row', gap: 6 },
}));
