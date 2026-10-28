import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { HeaderAvatars } from '@/features/account/HeaderAvatars';
import { useAccount, useNames } from '@/features/account/account';
import { CardActions } from '@/features/deck/CardActions';
import { CardList } from '@/features/deck/CardList';
import { type Card, balanceTilt, laterCount, myCards, myDeck, partnerCards, waitingCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { type SwipeDir, SwipeDeck } from '@/features/deck/SwipeDeck';
import { PartnerDropZone } from '@/features/deck/tradeTarget';
import { type Move, useMoves } from '@/features/deck/useMoves';
import { useOpenDrop } from '@/features/drop/DropSheet';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';

function balanceCopy(tilt: number, partner: string | null) {
  if (!partner) return { title: 'Just you for now.', sub: 'Dealing starts when your partner joins.' };
  if (Math.abs(tilt) < 0.2) return { title: 'Even keel this week.', sub: 'Nobody’s keeping score.' };
  if (tilt < 0) return { title: 'You’re carrying more this week.', sub: 'The next hands will go lighter on you.' };
  return { title: `${partner}’s carrying more this week.`, sub: 'A good week to grab something off the table.' };
}

const SWIPE: Record<'deal' | 'active', Partial<Record<SwipeDir, Move>>> = {
  deal: { right: 'take', up: 'together', left: 'trade', down: 'later', give: 'trade' },
  active: { right: 'done', left: 'later', give: 'trade' },
};

export default function DeckScreen() {
  const { state, ready } = useDeck();
  const [updating, setUpdating] = useState<Card | null>(null);
  const [options, setOptions] = useState<Card | null>(null);
  const [view, setView] = useState<'deck' | 'all'>('deck');
  const { inviteCode } = useAccount();
  const names = useNames();
  const openDrop = useOpenDrop();
  const move = useMoves();
  const cards = myDeck(state);
  const all = myCards(state);
  const tilt = balanceTilt(state);
  const copy = balanceCopy(tilt, names.partner);
  const waiting = waitingCards(state).filter((c) => c.owner !== 'partner');
  const partnerOn = partnerCards(state).find((c) => c.status !== 'waiting');
  const later = laterCount(state);
  const top = cards[0];

  const onSwipe = (card: Card, dir: SwipeDir) => {
    const m = SWIPE[card.status === 'active' ? 'active' : 'deal'][dir];
    if (m) move(card, m);
  };

  const total = all.length + waiting.length;

  return (
    <Screen
      kicker={new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
      title="Your deck"
      scroll={false}
      right={<HeaderAvatars wrapPartner={(n) => <PartnerDropZone>{n}</PartnerDropZone>} />}
    >
      <View style={styles.week}>
        <Seesaw tilt={tilt} scale={0.36} colors={names.hex} />
        <View style={styles.flex}>
          <Text variant="title/md">{copy.title}</Text>
          <Text variant="body/md" color={theme.color.text.secondary}>{partnerOn && names.partner ? `${names.partner} is on “${partnerOn.title.toLowerCase()}”.` : copy.sub}</Text>
        </View>
      </View>

      {!names.partner && inviteCode && <InviteStrip code={inviteCode} />}

      {ready && total > 0 && (
        <Segmented value={view} onChange={setView} options={[{ value: 'deck', label: 'Deck' }, { value: 'all', label: `All cards  ·  ${total}` }]} />
      )}

      {!ready ? null : view === 'all' && total > 0 ? (
        <CardList
          onOpen={setOptions}
          groups={[
            { label: 'Up to you', hint: 'take, trade or share', cards: all.filter((c) => c.status === 'deal') },
            { label: 'On your plate', cards: all.filter((c) => c.status === 'active' && c.owner === 'me') },
            { label: 'Together', hint: `on ${names.partner ? `${names.partner}’s` : 'both'} deck too`, cards: all.filter((c) => c.status === 'active' && c.owner === 'together') },
            { label: 'Waiting on others', cards: waiting },
          ]}
        />
      ) : cards.length && top ? (
        <View style={styles.deckWrap}>
          <SwipeDeck cards={cards} onSwipe={onSwipe} onHold={setUpdating} />
          <View style={styles.bar}>
            <PopButton label="Options" tone="ghost" onPress={() => { haptics.tick(); setOptions(top); }} />
            <PopButton
              label={top.status === 'active' ? 'Done' : 'Take it'}
              tone="cream"
              onPress={() => move(top, top.status === 'active' ? 'done' : 'take')}
            />
          </View>
          <Text variant="caption" color={theme.color.text.muted} style={styles.center}>
            {`${cards.length - 1 > 0 ? `${cards.length - 1} more behind it` : 'Last card'}${later ? `  ·  ${later} resting in later` : ''}  ·  tap to flip, hold to update`}
          </Text>
        </View>
      ) : state.cards.length === 0 ? (
        <FirstDrop onDrop={() => openDrop()} />
      ) : (
        <HandCleared onDrop={() => openDrop()} />
      )}

      {view === 'deck' && waiting.length > 0 && (
        <Pressable style={styles.waiting} onPress={() => setView('all')} accessibilityRole="button">
          <Text variant="label/md" color={theme.color.text.muted}>{`Waiting on others  ·  ${waiting.length}`}</Text>
          <Text variant="body/md" numberOfLines={1}>{`${waiting[0].title}${waiting.length > 1 ? ' and more' : ''}  ›`}</Text>
        </Pressable>
      )}
      {options && <CardActions card={options} onClose={() => setOptions(null)} onUpdate={setUpdating} />}
      {updating && <UpdateSheet card={updating} onClose={() => setUpdating(null)} />}
    </Screen>
  );
}

function HandCleared({ onDrop }: { onDrop: () => void }) {
  const names = useNames();
  useEffect(() => { haptics.success(); }, []);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.cleared}>
      <Animated.View entering={ZoomIn.springify().damping(12)}>
        <Seesaw tilt={0} scale={0.9} colors={names.hex} />
      </Animated.View>
      <Text variant="display/lg" style={styles.center}>Hand cleared.</Text>
      <Text variant="body/lg" color={theme.color.text.secondary} style={styles.center}>Nothing left on your deck. Your story landed in the album.</Text>
      <PopButton label="See the album" tone="ghost" onPress={() => router.navigate('/us')} />
      <PopButton label="Drop something new" tone="cream" onPress={onDrop} />
    </Animated.View>
  );
}

function FirstDrop({ onDrop }: { onDrop: () => void }) {
  return (
    <View style={styles.cleared}>
      <Text variant="display/lg" style={styles.center}>Empty deck.</Text>
      <Text variant="body/lg" color={theme.color.text.secondary} style={styles.center}>Drop the first thing on your mind. One line, no dates, no owners.</Text>
      <PopButton label="Drop something" tone="cream" onPress={onDrop} />
    </View>
  );
}

function InviteStrip({ code }: { code: string }) {
  const share = () => Share.share({ message: `Join me on usync so we can share the life admin. Open the app and enter this code: ${code}` }).catch(() => undefined);
  return (
    <View style={styles.invite}>
      <Text variant="label/md" color={theme.color.text.secondary}>Invite your person</Text>
      <Text variant="display/lg" style={styles.code}>{code}</Text>
      <Text variant="body/md" color={theme.color.text.secondary}>They sign up, then join with this code. Until then, drops wait on your deck.</Text>
      <PopButton label="Share code" tone="cream" onPress={share} />
    </View>
  );
}

const styles = StyleSheet.create({
  invite: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.color.border.strong, padding: 16, gap: 8 },
  code: { letterSpacing: 6 },
  week: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.bg.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  flex: { flex: 1, gap: 2 },
  deckWrap: { gap: 10 },
  bar: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  waiting: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.border.strong, padding: 14, gap: 4 },
  cleared: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  center: { textAlign: 'center' },
});
