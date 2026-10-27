import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useAccount, useNames } from '@/features/account/account';
import { type Card, balanceTilt, laterCount, myDeck, partnerCards, waitingCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { type SwipeDir, SwipeDeck } from '@/features/deck/SwipeDeck';
import { PartnerDropZone } from '@/features/deck/tradeTarget';
import { useOpenDrop } from '@/features/drop/DropSheet';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

function balanceCopy(tilt: number, partner: string | null) {
  if (!partner) return { title: 'Just you for now.', sub: 'Dealing starts when your partner joins.' };
  if (Math.abs(tilt) < 0.2) return { title: 'Even keel this week.', sub: 'Nobody’s keeping score.' };
  if (tilt < 0) return { title: 'You’re carrying more this week.', sub: 'The next hands will go lighter on you.' };
  return { title: `${partner}’s carrying more this week.`, sub: 'A good week to grab something off the table.' };
}

export default function DeckScreen() {
  const { state, dispatch, ready } = useDeck();
  const [updating, setUpdating] = useState<Card | null>(null);
  const { inviteCode } = useAccount();
  const names = useNames();
  const toast = useToast();
  const openDrop = useOpenDrop();
  const cards = myDeck(state);
  const tilt = balanceTilt(state);
  const copy = balanceCopy(tilt, names.partner);
  const waiting = waitingCards(state);
  const partnerOn = partnerCards(state).find((c) => c.status !== 'waiting');

  const undoable = (title: string, body: string) =>
    toast({ kind: 'info', title, body, action: { label: 'Undo', onPress: () => { haptics.tick(); dispatch({ type: 'undo' }); } }, onExpire: () => dispatch({ type: 'clearUndo' }) });

  const onSwipe = (card: Card, dir: SwipeDir) => {
    if (card.status === 'active') {
      if (dir === 'right') {
        dispatch({ type: 'done', id: card.id });
        haptics.success();
        undoable('Done  ·  into the album', card.title);
      } else {
        dispatch({ type: 'later', id: card.id });
        haptics.trade();
        undoable('Moved to later', 'Out of sight this week. It comes back on its own.');
      }
      return;
    }
    if (dir === 'right') { dispatch({ type: 'take', id: card.id }); haptics.take(); undoable('It’s yours', card.title); }
    if (dir === 'up') { dispatch({ type: 'together', id: card.id }); haptics.together(); undoable('Doing it together', 'It’s on both decks now.'); }
    if (dir === 'left') {
      dispatch({ type: 'trade', id: card.id });
      haptics.trade();
      undoable(card.traded ? 'Passed to the table' : `Traded to ${names.partnerOr}`, card.traded ? 'The trade was used, so it’s up for grabs.' : 'They can take it or pass it to the table.');
    }
  };

  const onHold = (card: Card) => setUpdating(card);



  const later = laterCount(state);

  return (
    <Screen kicker={new Date().toLocaleDateString('en-IN', { weekday: 'long' })} title="Your deck" scroll={false} initials={names.initials} wrapPartner={(n) => <PartnerDropZone>{n}</PartnerDropZone>}>
      <View style={styles.week}>
        <Seesaw tilt={tilt} scale={0.36} />
        <View style={styles.flex}>
          <Text variant="title/md">{copy.title}</Text>
          <Text variant="body/md" color={theme.color.text.secondary}>{partnerOn && names.partner ? `${names.partner} is on “${partnerOn.title.toLowerCase()}”.` : copy.sub}</Text>
        </View>
      </View>

      {!names.partner && inviteCode && <InviteStrip code={inviteCode} />}

      {!ready ? null : cards.length ? (
        <View>
          <SwipeDeck cards={cards} onSwipe={onSwipe} onHold={onHold} />
          <Text variant="caption" color={theme.color.text.muted}>
            {`${cards.length - 1 > 0 ? `${cards.length - 1} more for today` : 'Last card for today'}${later ? `  ·  ${later} resting in later` : ''}  ·  tap to flip`}
          </Text>
        </View>
      ) : state.cards.length === 0 ? (
        <FirstDrop onDrop={openDrop} />
      ) : (
        <HandCleared onDrop={openDrop} />
      )}

      {waiting.length > 0 && (
        // One line only: the deck can't scroll (it would fight the swipes), so the list lives on Us.
        <Pressable style={styles.waiting} onPress={() => router.navigate('/us')} accessibilityRole="link">
          <Text variant="label/md" color={theme.color.text.muted}>{`Waiting on others  ·  ${waiting.length}`}</Text>
          <Text variant="body/md" numberOfLines={1}>{`${waiting[0].title}${waiting.length > 1 ? ' and more' : ''}  ›`}</Text>
        </Pressable>
      )}
      {updating && <UpdateSheet card={updating} onClose={() => setUpdating(null)} />}
    </Screen>
  );
}

function HandCleared({ onDrop }: { onDrop: () => void }) {
  useEffect(() => { haptics.success(); }, []);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.cleared}>
      <Animated.View entering={ZoomIn.springify().damping(12)}>
        <Seesaw tilt={0} scale={0.9} />
      </Animated.View>
      <Text variant="display/lg" style={styles.center}>Hand cleared.</Text>
      <Text variant="body/lg" color={theme.color.text.secondary} style={styles.center}>Nothing left on your deck. Your story landed in the album.</Text>
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
      <Text variant="label/md" color={theme.color.partner.b}>Invite your person</Text>
      <Text variant="display/lg" style={styles.code}>{code}</Text>
      <Text variant="body/md" color={theme.color.text.secondary}>They sign up, then join with this code. Until then, drops wait on your deck.</Text>
      <PopButton label="Share code" tone="lagoon" onPress={share} />
    </View>
  );
}

const styles = StyleSheet.create({
  invite: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.color.partner.b, padding: 16, gap: 8 },
  code: { letterSpacing: 6 },
  week: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.bg.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  flex: { flex: 1, gap: 2 },
  waiting: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.border.strong, padding: 14, gap: 4 },
  cleared: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  center: { textAlign: 'center' },
});
