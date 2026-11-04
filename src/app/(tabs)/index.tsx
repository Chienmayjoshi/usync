import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
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
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { FilterChips } from '@/ui/FilterChips';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
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
  const t = useTheme();
  const styles = useStyles();
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
      title="On table"
      scroll={false}
      right={<HeaderAvatars wrapPartner={(n) => <PartnerDropZone>{n}</PartnerDropZone>} />}
    >
      <View style={styles.week}>
        <Seesaw tilt={tilt} scale={0.36} colors={names.hex} />
        <View style={styles.flex}>
          <Text variant="title/md">{copy.title}</Text>
          <Text variant="body/md" color={t.color.text.secondary}>{partnerOn && names.partner ? `${names.partner} is on “${partnerOn.title.toLowerCase()}”.` : copy.sub}</Text>
        </View>
      </View>

      {!names.partner && inviteCode && <InviteStrip code={inviteCode} />}

      {ready && total > 0 && (
        <FilterChips
          value={view}
          onChange={setView}
          glow={t.tones[names.colors.me].glow}
          options={[{ value: 'deck', label: 'My deck', count: cards.length }, { value: 'all', label: 'All cards', count: total }]}
        />
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
              tone="positive"
              fill
              onPress={() => move(top, top.status === 'active' ? 'done' : 'take')}
            />
          </View>
          <Text variant="caption" color={t.color.text.muted} style={styles.center}>
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
          <Text variant="label/md" color={t.color.text.muted}>{`Waiting on others  ·  ${waiting.length}`}</Text>
          <Text variant="body/md" numberOfLines={1}>{`${waiting[0].title}${waiting.length > 1 ? ' and more' : ''}  ›`}</Text>
        </Pressable>
      )}
      {options && <CardActions card={options} onClose={() => setOptions(null)} onUpdate={setUpdating} />}
      {updating && <UpdateSheet card={updating} onClose={() => setUpdating(null)} />}
    </Screen>
  );
}

function HandCleared({ onDrop }: { onDrop: () => void }) {
  const t = useTheme();
  const styles = useStyles();
  const names = useNames();
  useEffect(() => { haptics.success(); }, []);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.cleared}>
      <Animated.View entering={ZoomIn.springify().damping(12)}>
        <Seesaw tilt={0} scale={0.9} colors={names.hex} />
      </Animated.View>
      <Text variant="display/xl" style={styles.center}>Hand cleared.</Text>
      <Text variant="body/lg" color={t.color.text.secondary} style={styles.center}>Nothing left on your deck. Your story landed in the album.</Text>
      <PopButton label="See the album" tone="ghost" onPress={() => router.navigate('/us')} />
      <PopButton label="Drop something new" tone="cream" onPress={onDrop} />
    </Animated.View>
  );
}

function FirstDrop({ onDrop }: { onDrop: () => void }) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.cleared}>
      <Text variant="display/xl" style={styles.center}>The table is clear.</Text>
      <Text variant="body/lg" color={t.color.text.secondary} style={styles.center}>Drop the first thing on your mind. One line, no dates, no owners.</Text>
      <PopButton label="Drop something" tone="cream" onPress={onDrop} />
    </View>
  );
}

function InviteStrip({ code }: { code: string }) {
  const t = useTheme();
  const styles = useStyles();
  const share = () => Share.share({ message: `Join me on usync so we can share the life admin. Open the app and enter this code: ${code}` }).catch(() => undefined);
  return (
    <View style={styles.invite}>
      <Text variant="label/md" color={t.color.text.secondary}>Invite your person</Text>
      <Text variant="display/lg" style={styles.code}>{code}</Text>
      <Text variant="body/md" color={t.color.text.secondary}>They sign up, then join with this code. Until then, drops wait on your deck.</Text>
      <PopButton label="Share code" tone="cream" onPress={share} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  invite: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.color.border.dashed, borderRadius: t.radius.lg, padding: 18, gap: 8 },
  code: { letterSpacing: 6 },
  week: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.color.bg.surface, borderRadius: t.radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  flex: { flex: 1, gap: 2 },
  deckWrap: { gap: 10 },
  bar: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  waiting: { borderWidth: 1, borderStyle: 'dashed', borderColor: t.color.border.dashed, borderRadius: t.radius.lg, padding: 16, gap: 4 },
  cleared: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  center: { textAlign: 'center' },
}));
