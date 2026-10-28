import { CaretRight } from 'phosphor-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useNames } from '@/features/account/account';
import { theme, tones } from '@/theme/tokens';
import { Text } from '@/ui/Text';

import { toneFor } from './DealCard';
import type { Card } from './model';

type Group = { label: string; cards: Card[]; hint?: string };

/** Every card on my side at once, grouped by what it needs from me. Tap one for its options. */
export function CardList({ groups, onOpen, footer }: { groups: Group[]; onOpen: (c: Card) => void; footer?: React.ReactNode }) {
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {groups.filter((g) => g.cards.length).map((g) => (
        <View key={g.label} style={styles.group}>
          <View style={styles.groupHead}>
            <Text variant="label/md" color={theme.color.text.muted}>{g.label}</Text>
            {g.hint && <Text variant="caption" color={theme.color.text.muted}>{g.hint}</Text>}
          </View>
          {g.cards.map((c) => <Row key={c.id} card={c} onPress={() => onOpen(c)} />)}
        </View>
      ))}
      {footer}
    </ScrollView>
  );
}

export function Row({ card, onPress }: { card: Card; onPress: () => void }) {
  const names = useNames();
  const tone = tones[toneFor(card, names.colors)];
  const meta = [card.bucket, card.effort, card.when].join('  ·  ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityHint="Opens what you can do with this card">
      <View style={[styles.bar, { backgroundColor: tone.accent }]} />
      <View style={styles.copy}>
        <Text variant="title/md">{card.title}</Text>
        <Text variant="caption" color={theme.color.text.secondary}>{meta}</Text>
        {card.status === 'waiting' && !!card.waitingNote && <Text variant="caption" color={theme.color.text.muted}>{card.waitingNote}</Text>}
        {card.droppedBy === 'partner' && <Text variant="label/md" color={tones[names.colors.partner].face}>{`from ${names.partnerOr}`}</Text>}
      </View>
      <CaretRight size={18} color={theme.color.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { gap: 20, paddingBottom: 120 },
  group: { gap: 8 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.bg.surface, borderWidth: 1, borderColor: theme.color.border.subtle, paddingVertical: 12, paddingRight: 14, overflow: 'hidden' },
  pressed: { backgroundColor: theme.color.bg.raised },
  bar: { width: 4, alignSelf: 'stretch' },
  copy: { flex: 1, gap: 3 },
});
