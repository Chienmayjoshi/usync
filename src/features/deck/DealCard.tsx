import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useAccount, useNames } from '@/features/account/account';
import { type PersonColor, theme, type Tone, tones } from '@/theme/tokens';
import { Edges } from '@/ui/Edges';
import { Text } from '@/ui/Text';

import type { Card } from './model';

export const CARD_DEPTH = 6;

export type People = { me: PersonColor; partner: PersonColor };

/** Each person's cards wear their own color; together is gold, the table neutral. */
export function toneFor(card: Card, colors: People): Tone {
  if (card.owner === 'together') return 'gold';
  if (card.owner === 'table') return 'neutral';
  if (card.owner === 'partner') return colors.partner;
  return colors.me;
}

export type Hints = { left: string | null; up: string | null; down: string | null; right: string };

/** Swipe hints per card. Solo (partner not joined yet) a deal can only be taken or skipped. */
export function hintsFor(card: Card, solo = false): Hints {
  if (card.status === 'active') return { left: 'later', up: null, down: null, right: 'done' };
  if (solo) return { left: null, up: null, down: 'skip', right: 'take it' };
  return { left: card.traded ? 'to the table' : 'trade', up: 'together', down: 'skip', right: 'take it' };
}

type Props = { card: Card; flip: SharedValue<number>; minHeight?: number };

/** A deck card with a front (the job) and a back (the job story). `flip` runs 0 -> 1. */
export function DealCard({ card, flip, minHeight = 260 }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const names = useNames();
  const tone = tones[toneFor(card, names.colors)];
  const hints = hintsFor(card, !useAccount().partner);
  const label = card.status === 'active' ? (card.owner === 'together' ? 'Together, on both decks' : 'On your deck')
    : card.owner === 'together' ? 'Together' : 'Dealt to you';
  const from = card.droppedBy === 'partner' ? `  ·  from ${names.partnerOr}` : '';

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
          <Text variant="label/md" color={tone.accent} style={styles.flex} numberOfLines={1}>{label + from}</Text>
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
          {hints.left ? <Text variant="caption" color={theme.color.text.muted}>{`← ${hints.left}`}</Text> : <View />}
          {(hints.up || hints.down) && (
            <Text variant="caption" color={theme.color.text.muted}>{[hints.up && `↑ ${hints.up}`, hints.down && `↓ ${hints.down}`].filter(Boolean).join('   ')}</Text>
          )}
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
