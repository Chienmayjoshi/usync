import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { type Card, balanceTilt, laterCount, myDeck, partnerCards, waitingCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { type SwipeDir, SwipeDeck } from '@/features/deck/SwipeDeck';
import { PartnerDropZone } from '@/features/deck/tradeTarget';
import { useOpenDrop } from '@/features/drop/DropSheet';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

function balanceCopy(tilt: number) {
  if (Math.abs(tilt) < 0.2) return { title: 'Even keel this week.', sub: 'Nobody’s keeping score.' };
  if (tilt < 0) return { title: 'You’re carrying more this week.', sub: 'The next hands will go lighter on you.' };
  return { title: 'Meera’s carrying more this week.', sub: 'A good week to grab something off the table.' };
}

export default function DeckScreen() {
  const { state, dispatch } = useDeck();
  const toast = useToast();
  const openDrop = useOpenDrop();
  const cards = myDeck(state);
  const tilt = balanceTilt(state);
  const copy = balanceCopy(tilt);
  const waiting = waitingCards(state);
  const partnerOn = partnerCards(state).find((c) => c.status !== 'waiting');
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (thanksTimer.current) clearTimeout(thanksTimer.current); }, []);

  const undoable = (title: string, body: string) =>
    toast({ kind: 'info', title, body, action: { label: 'Undo', onPress: () => { haptics.tick(); dispatch({ type: 'undo' }); } }, onExpire: () => dispatch({ type: 'clearUndo' }) });

  const onSwipe = (card: Card, dir: SwipeDir) => {
    if (card.status === 'active') {
      if (dir === 'right') {
        dispatch({ type: 'done', id: card.id });
        haptics.success();
        undoable('Done  ·  into the album', card.title);
        // Demo of the thanks loop: in the real app this arrives when Meera taps the heart.
        thanksTimer.current = setTimeout(() => {
          haptics.success();
          toast({ kind: 'thanks', title: 'Meera sent a heart', body: `for “${card.title.toLowerCase()}”`, ms: 4000 });
        }, 2600);
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
      undoable(card.traded ? 'Passed to the table' : 'Traded to Meera', card.traded ? 'The trade was used, so it’s up for grabs.' : 'She can take it or pass it to the table.');
    }
  };

  const onHold = (card: Card) => {
    haptics.take();
    toast({ kind: 'info', title: 'Hold to update', body: `Voice updates for “${card.title}” arrive in the next build.`, ms: 3000 });
  };

  const later = laterCount(state);

  return (
    <Screen kicker="Tuesday  ·  morning hand" title="Your deck" scroll={false} wrapPartner={(n) => <PartnerDropZone>{n}</PartnerDropZone>}>
      <View style={styles.week}>
        <Seesaw tilt={tilt} scale={0.36} />
        <View style={styles.flex}>
          <Text variant="title/md">{copy.title}</Text>
          <Text variant="body/md" color={theme.color.text.secondary}>{partnerOn ? `Meera is on “${partnerOn.title.toLowerCase()}”.` : copy.sub}</Text>
        </View>
      </View>

      {cards.length ? (
        <View>
          <SwipeDeck cards={cards} onSwipe={onSwipe} onHold={onHold} />
          <Text variant="caption" color={theme.color.text.muted}>
            {`${cards.length - 1 > 0 ? `${cards.length - 1} more for today` : 'Last card for today'}${later ? `  ·  ${later} resting in later` : ''}  ·  tap to flip`}
          </Text>
        </View>
      ) : (
        <HandCleared onDrop={openDrop} />
      )}

      {waiting.length > 0 && (
        <View style={styles.waiting}>
          <Text variant="label/md" color={theme.color.text.muted}>Waiting on others</Text>
          {waiting.map((w) => <Text key={w.id} variant="body/md">{`${w.title}  ·  ${w.when}`}</Text>)}
        </View>
      )}
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
      <Text variant="body/lg" color={theme.color.text.secondary} style={styles.center}>Meera{'’'}s on her last one. Your story landed in the album.</Text>
      <PopButton label="Drop something new" tone="cream" onPress={onDrop} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.bg.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  flex: { flex: 1, gap: 2 },
  waiting: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.border.strong, padding: 14, gap: 4 },
  cleared: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  center: { textAlign: 'center' },
});
