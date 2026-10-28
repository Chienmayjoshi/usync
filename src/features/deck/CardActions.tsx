import { StyleSheet, View } from 'react-native';

import { useAccount, useNames } from '@/features/account/account';
import { useDeck } from '@/features/deck/store';
import { theme, tones } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import { toneFor } from './DealCard';
import { canHandOff, type Card } from './model';
import { type Move, useMoves } from './useMoves';

type Props = { card: Card; onClose: () => void; onUpdate: (card: Card) => void };

/**
 * Every move a card allows, as plain buttons. Swipes stay the fast path; this is the one that
 * explains itself, and the only way to reach moves a swipe cannot (table, done from a deal).
 */
export function CardActions({ card, onClose, onUpdate }: Props) {
  const { partner } = useAccount();
  const { resume } = useDeck();
  const names = useNames();
  const move = useMoves();
  const tone = tones[toneFor(card, names.colors)];
  const act = (m: Move) => { onClose(); move(card, m); };

  const deal = card.status === 'deal';
  const handOff = !!partner && canHandOff(card);
  const label = card.owner === 'table' ? 'On the open table'
    : card.status === 'waiting' ? 'Waiting on someone else'
      : card.owner === 'together' ? 'Together' : deal ? 'Dealt to you' : 'On your deck';

  return (
    <Sheet onClose={onClose}>
      <Text variant="label/md" color={tone.accent}>{label}</Text>
      <Text variant="title/lg">{card.title}</Text>
      <View style={styles.chips}>
        {[card.bucket, card.effort, card.when].map((g) => (
          <View key={g} style={styles.chip}><Text variant="label/md" color={theme.color.text.secondary}>{g}</Text></View>
        ))}
      </View>
      {card.status === 'waiting' && !!card.waitingNote && <Text variant="body/md" color={theme.color.text.secondary}>{card.waitingNote}</Text>}

      <View style={styles.actions}>
        {card.owner === 'table' ? (
          <PopButton label="Grab it" tone="cream" onPress={() => act('grab')} />
        ) : card.status === 'waiting' ? (
          <PopButton label="They came through: back on my deck" tone="cream" onPress={() => { onClose(); resume(card.id).catch(() => undefined); }} />
        ) : deal ? (
          <>
            <PopButton label="Take it" tone="cream" onPress={() => act('take')} />
            {!!partner && <PopButton label="Do it together" tone="gold" onPress={() => act('together')} />}
          </>
        ) : null}

        <PopButton label={deal ? 'Already done it' : 'Mark done'} tone={deal || card.status === 'waiting' || card.owner === 'table' ? 'ghost' : 'cream'} onPress={() => act('done')} />
        <PopButton label="Add an update" tone="ghost" onPress={() => { onClose(); onUpdate(card); }} />
        {handOff && !card.traded && <PopButton label={`Trade to ${names.partnerOr}`} tone="ghost" onPress={() => act('trade')} />}
        {handOff && card.owner !== 'table' && <PopButton label="Put it on the open table" tone="ghost" onPress={() => act('table')} />}
        {(deal || card.status === 'active') && (card.owner === 'me' || card.owner === 'together') && (
          <PopButton label={deal ? 'Skip for now' : 'Later'} tone="ghost" onPress={() => act('later')} />
        )}
      </View>
      {handOff && card.traded && <Text variant="caption" color={theme.color.text.muted}>This card already used its one trade, so it can only go to the table.</Text>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.border.strong, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  actions: { gap: 8, marginTop: 4 },
});
