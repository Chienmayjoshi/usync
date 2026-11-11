import { useState } from 'react';
import { View } from 'react-native';

import { HeaderAvatars } from '@/features/account/HeaderAvatars';
import { useNames } from '@/features/account/account';
import { Row } from '@/features/deck/CardList';
import { type Card, partnerDeck, togetherCards, waitingCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
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
  // Looking through their deck is private: the stack scrolls locally, their pile never reorders.
  const ranked = partnerDeck(state);
  const together = togetherCards(state);
  const waiting = waitingCards(state);
  const them = names.partner;

  return (
    <Screen title={them ?? 'Partner'} right={<HeaderAvatars />}>
      {!them ? (
        <Text variant="body/lg" color={t.color.text.secondary}>Your partner hasn’t joined yet. Share your code from the Table.</Text>
      ) : !ready ? null : ranked.length ? (
        // A glance, not a decision: her deck as rows. Tap one for its story and "Ask for this".
        <Section label={`On ${them}’s deck  ·  ${ranked.length}`}>
          {ranked.map((c) => <Row key={c.id} card={c} onPress={() => setUpdating(c)} />)}
        </Section>
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
      {updating && (
        <UpdateSheet
          card={updating}
          onClose={() => setUpdating(null)}
          onAsk={updating.owner === 'partner' && updating.status === 'active' && !updating.request ? () => move(updating, 'ask_for') : undefined}
        />
      )}
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
