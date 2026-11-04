import { useState } from 'react';
import { View } from 'react-native';

import { HeaderAvatars } from '@/features/account/HeaderAvatars';
import { useNames } from '@/features/account/account';
import { CardStack } from '@/features/deck/CardStack';
import { Row } from '@/features/deck/CardList';
import { type Card, partnerDeck, togetherCards, waitingCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/**
 * Your partner's deck, the way they see it: swipe up to look through it, tap a card for its
 * story, and ask for one you'd rather do. Below it, what you share and what is waiting.
 */
export default function PartnerScreen() {
  const t = useTheme();
  const s = useStyles();
  const { state, ready } = useDeck();
  const names = useNames();
  const move = useMoves();
  const [updating, setUpdating] = useState<Card | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const theirs = partnerDeck(state);
  // Looking through their deck is private: rotate locally, never reorder their pile.
  const ranked = [...theirs].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const together = togetherCards(state);
  const waiting = waitingCards(state);
  const them = names.partner;

  return (
    <Screen title={them ?? 'Partner'} right={<HeaderAvatars />}>
      {!them ? (
        <Text variant="body/lg" color={t.color.text.secondary}>Your partner hasn’t joined yet. Share your code from the Table.</Text>
      ) : !ready ? null : ranked.length ? (
        <>
          <Text variant="label/md" color={t.color.text.secondary}>{`On ${them}’s deck  ·  ${ranked.length}`}</Text>
          <CardStack
            cards={ranked}
            actions={{ up: { label: 'Next', color: t.color.text.secondary, run: (c) => setOrder((o) => [...o.filter((x) => x !== c.id), c.id]) } }}
            onUpdate={setUpdating}
            footer={(c) => (c.status === 'active' && !c.request ? (
              <View style={s.footer}>
                <PopButton label="Ask for this" tone="ghost" small onPress={() => move(c, 'ask_for')} />
              </View>
            ) : null)}
          />
        </>
      ) : (
        <View style={s.empty}>
          <Text variant="display/lg">{`${them}’s deck is clear.`}</Text>
          <Text variant="body/md" color={t.color.text.secondary}>Nothing on their plate right now. A rare calm.</Text>
        </View>
      )}

      {together.length > 0 && (
        <Section label="Doing together">
          {together.map((c) => <Row key={c.id} card={c} onPress={() => setUpdating(c)} />)}
        </Section>
      )}
      {waiting.length > 0 && (
        <Section label="Waiting on others" hint="never counts as a slip">
          {waiting.map((c) => <Row key={c.id} card={c} onPress={() => setUpdating(c)} />)}
        </Section>
      )}
      {updating && <UpdateSheet card={updating} onClose={() => setUpdating(null)} />}
    </Screen>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text variant="label/md" color={t.color.text.secondary}>{label}</Text>
        {hint && <Text variant="caption" color={t.color.text.muted}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  footer: { flexDirection: 'row', marginTop: 6 },
  empty: { gap: 8, paddingVertical: 32, alignItems: 'flex-start' },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
}));
