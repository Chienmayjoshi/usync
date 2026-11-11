import { CaretRight } from 'phosphor-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { useNames } from '@/features/account/account';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

import { toneFor } from './DealCard';
import type { Card } from './model';

type Group = { label: string; cards: Card[]; hint?: string };

/** Every card on my side at once, grouped by what it needs from me. Tap one for its options. */
export function CardList({ groups, onOpen, footer }: { groups: Group[]; onOpen: (c: Card) => void; footer?: React.ReactNode }) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {groups.filter((g) => g.cards.length).map((g) => (
        <View key={g.label} style={styles.group}>
          <View style={styles.groupHead}>
            <Text variant="label/md" color={t.color.text.muted}>{g.label}</Text>
            {g.hint && <Text variant="caption" color={t.color.text.muted}>{g.hint}</Text>}
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
  const t = useTheme();
  const styles = useStyles();
  const tone = t.tones[toneFor(card, names.colors)];
  const meta = [card.bucket, card.effort, card.when].join('  ·  ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityHint="Opens what you can do with this card">
      <View style={[styles.bar, { backgroundColor: tone.accent }]} />
      <View style={styles.copy}>
        <Text variant="title/md">{card.title}</Text>
        <Text variant="caption" color={t.color.text.secondary}>{meta}</Text>
        {card.status === 'waiting' && !!card.waitingNote && <Text variant="caption" color={t.color.text.muted}>{card.waitingNote}</Text>}
        {card.droppedBy === 'partner' && <Text variant="label/md" color={t.tones[names.colors.partner].ink}>{`from ${names.partnerOr}`}</Text>}
        {card.request === 'give' && card.requestedBy === 'me' && <Text variant="label/md" color={t.color.accent.tag}>You asked for it</Text>}
      </View>
      <CaretRight size={18} color={t.color.text.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1 },
  body: { gap: 20, paddingBottom: 120 },
  group: { gap: 8 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.color.bg.surface, borderRadius: t.radius.md, paddingVertical: 14, paddingLeft: 14, paddingRight: 14, overflow: 'hidden' },
  pressed: { opacity: 0.7 },
  bar: { width: 10, height: 10, borderRadius: 5 },
  copy: { flex: 1, gap: 3 },
}));
