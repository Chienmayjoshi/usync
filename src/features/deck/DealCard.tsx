import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { theme, type Tone, tones } from '@/theme/tokens';
import { Edges } from '@/ui/Edges';
import { Text } from '@/ui/Text';

import type { Card } from './model';

export const CARD_DEPTH = 6;

export function toneFor(card: Card): Tone {
  if (card.owner === 'together') return 'gold';
  if (card.owner === 'table') return 'neutral';
  if (card.owner === 'partner') return 'lagoon';
  return 'ember';
}

export function hintsFor(card: Card) {
  if (card.status === 'active') return { left: 'later', up: null, right: 'done' };
  return { left: card.traded ? 'to the table' : 'trade', up: 'together', right: 'take it' };
}

type Props = { card: Card; flip: SharedValue<number>; minHeight?: number };

/** A deck card with a front (the job) and a back (the job story). `flip` runs 0 -> 1. */
export function DealCard({ card, flip, minHeight = 260 }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tone = tones[toneFor(card)];
  const hints = hintsFor(card);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
  }));

  const face = [styles.face, { borderColor: tone.accent, minHeight }];

  return (
    <View style={{ paddingRight: CARD_DEPTH, paddingBottom: CARD_DEPTH }}>
      <Edges width={size.w} height={size.h} depth={CARD_DEPTH} edge={tone.edge} edgeDeep={tone.edgeDeep} />
      <Animated.View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={[face, styles.hidden, front]}>
        <View style={styles.top}>
          <Text variant="label/md" color={tone.accent}>{card.status === 'active' ? 'On your deck' : card.owner === 'together' ? 'Together' : 'Dealt to you'}</Text>
          <View style={styles.grip} accessibilityLabel="Hold to update">
            {[0, 1, 2].map((i) => <View key={i} style={styles.dot} />)}
          </View>
        </View>
        <Text variant="title/lg" style={styles.gap}>{card.title}</Text>
        {!!card.detail && <Text variant="body/md" color={theme.color.text.secondary}>{card.detail}</Text>}
        <View style={styles.chips}>
          {[card.bucket, card.effort, card.when].map((g) => (
            <View key={g} style={[styles.chip, g === card.bucket && card.bucket === 'Us' && { borderColor: theme.color.together.base }]}>
              <Text variant="label/md" color={g === card.bucket && card.bucket === 'Us' ? theme.color.together.base : theme.color.text.secondary}>{g}</Text>
            </View>
          ))}
        </View>
        <View style={styles.spacer} />
        <View style={styles.hints}>
          <Text variant="caption" color={theme.color.text.muted}>{`← ${hints.left}`}</Text>
          {hints.up && <Text variant="caption" color={theme.color.text.muted}>{`↑ ${hints.up}`}</Text>}
          <Text variant="caption" color={theme.color.text.muted}>{`${hints.right} →`}</Text>
        </View>
      </Animated.View>
      <Animated.View style={[face, styles.hidden, styles.back, back]}>
        <Text variant="label/md" color={theme.color.text.muted}>The story so far</Text>
        <Text variant="title/lg" style={styles.gap}>{card.title}</Text>
        {(card.story.length ? card.story : ['Nothing yet. Hold the card to add an update.']).map((s, i) => (
          <View key={`${i}-${s}`} style={styles.event}>
            <View style={[styles.eventDot, { backgroundColor: i === card.story.length - 1 ? tone.accent : theme.color.border.strong }]} />
            <Text variant="body/md" style={styles.flex}>{s}</Text>
          </View>
        ))}
        <View style={styles.spacer} />
        <Text variant="caption" color={theme.color.text.muted}>Written by usync from your one line updates. Tap to flip back.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { backgroundColor: theme.color.bg.raised, borderWidth: 1.5, padding: 24, gap: 10 },
  hidden: { backfaceVisibility: 'hidden' },
  back: { position: 'absolute', top: 0, left: 0, right: CARD_DEPTH, bottom: CARD_DEPTH, borderColor: theme.color.border.strong },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grip: { flexDirection: 'row', gap: 3, padding: 8, margin: -8 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.color.text.muted },
  gap: { marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 },
  chip: { borderWidth: 1, borderColor: theme.color.border.strong, borderStyle: 'dashed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  spacer: { flex: 1, minHeight: 8 },
  hints: { flexDirection: 'row', justifyContent: 'space-between' },
  event: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
});
