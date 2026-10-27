import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useNames } from '@/features/account/account';
import { type Card, partnerCards, tableCards, waitingCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useSync } from '@/features/sync/sync';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { errorText } from '@/lib/supabase';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

export default function UsScreen() {
  const { state, dispatch, thanked, sendThanks, resume } = useDeck();
  const toast = useToast();
  const { weeks } = useSync();
  const waiting = waitingCards(state);
  const comeThrough = (card: Card, done: boolean) => {
    haptics.take();
    if (done) {
      dispatch({ type: 'done', id: card.id });
      toast({ kind: 'info', title: 'Done  ·  into the album', body: card.title, ms: 3000 });
    } else {
      resume(card.id).catch((e) => toast({ kind: 'info', title: 'That didn’t save', body: errorText(e) }));
    }
  };
  const names = useNames();
  const glance = partnerCards(state);
  const table = tableCards(state);
  // Their wins from the last week, newest first: the place to send a heart.
  const [weekAgo] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const wins = state.cards
    .filter((c) => c.status === 'done' && c.doneBy === 'partner' && c.doneAt && Date.parse(c.doneAt) > weekAgo)
    .sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''));

  return (
    <Screen kicker="Us" title="The two of you" initials={names.initials}>
      <View style={styles.glance}>
        <Text variant="label/md" color={theme.color.partner.b}>{names.partner ? `${names.partner}’s on` : 'Your partner hasn’t joined yet'}</Text>
        {glance.length ? glance.map((c) => (
          <View key={c.id} style={styles.glanceRow}>
            <View style={styles.dot} />
            <Text variant="body/md" style={styles.flex}>{c.status === 'waiting' ? `${c.title}  ·  waiting on someone` : c.title}</Text>
          </View>
        )) : <Text variant="body/md">Nothing right now. A rare calm.</Text>}
        <Text variant="caption" color={theme.color.text.muted}>Glance only. No dates, no history.</Text>
      </View>

      {waiting.length > 0 && (
        <View style={styles.waiting}>
          <Text variant="label/md" color={theme.color.text.muted}>Waiting on others</Text>
          {waiting.map((w) => (
            <View key={w.id} style={styles.waitRow}>
              <Text variant="title/md">{w.title}</Text>
              {w.waitingNote && <Text variant="body/md" color={theme.color.text.secondary}>{w.waitingNote}</Text>}
              <View style={styles.waitActions}>
                <PopButton label="Back on track" tone="ghost" onPress={() => comeThrough(w, false)} />
                <PopButton label="Done" tone="ghost" onPress={() => comeThrough(w, true)} />
              </View>
            </View>
          ))}
        </View>
      )}

      {wins.length > 0 && (
        <View style={styles.wins}>
          <Text variant="label/md" color={theme.color.together.base}>{`${names.partnerOr} got these done`}</Text>
          {wins.map((c) => (
            <View key={c.id} style={styles.winRow}>
              <Text variant="title/md" style={styles.flex}>{c.title}</Text>
              {thanked.has(c.id) ? (
                <Text variant="label/md" color={theme.color.together.base}>Heart sent</Text>
              ) : (
                <PopButton label="Send a heart" tone="gold" onPress={() => { haptics.success(); sendThanks(c.id).catch(() => undefined); }} />
              )}
            </View>
          ))}
        </View>
      )}

      <Text variant="label/md" color={theme.color.text.muted}>On the table  {'·'}  first to grab owns it</Text>
      {table.length ? table.map((c) => (
        <Animated.View key={c.id} entering={FadeInDown} layout={LinearTransition} style={styles.tableCard}>
          <Text variant="label/md" color={theme.color.text.secondary}>{`${c.bucket}  ·  ${c.effort}`}</Text>
          <Text variant="title/lg">{c.title}</Text>
          <Text variant="body/md" color={theme.color.text.secondary}>Nobody kept it. Still here Sunday? It goes into Sync{'’'}s next hand.</Text>
          <PopButton label="Grab it" tone="cream" onPress={() => { haptics.take(); dispatch({ type: 'grab', id: c.id }); }} />
        </Animated.View>
      )) : <Text variant="body/md" color={theme.color.text.secondary}>The table is clear. Swipe a traded card left on your deck to put it here.</Text>}

      <View style={styles.albumHead}>
        <Text variant="label/md" color={theme.color.together.base}>Your story album</Text>
        <Text variant="caption" color={theme.color.text.muted}>{`${weeks} ${weeks === 1 ? 'week' : 'weeks'} in sync`}</Text>
      </View>
      <View style={styles.album}>
        {state.album.map((s, i) => (
          <Animated.View key={s.id} entering={FadeInDown.delay(i * 60)} style={[styles.story, s.together && styles.storyTogether]}>
            <Text variant="label/md" color={s.together ? theme.color.together.base : theme.color.text.muted}>{s.together ? 'Together' : s.when}</Text>
            <Text variant="display/accent" style={styles.storyTitle}>{s.title}</Text>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glance: { backgroundColor: theme.color.bg.surface, borderRadius: 12, padding: 14, gap: 8 },
  waiting: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.border.strong, padding: 14, gap: 10 },
  waitRow: { gap: 4 },
  waitActions: { flexDirection: 'row', gap: 8 },
  wins: { borderWidth: 1.5, borderColor: theme.color.together.base, padding: 14, gap: 10 },
  winRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.partner.b },
  flex: { flex: 1 },
  tableCard: { backgroundColor: theme.color.bg.raised, borderWidth: 1.5, borderColor: theme.color.border.strong, padding: 20, gap: 10 },
  albumHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  album: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  story: { width: '47%', minHeight: 120, backgroundColor: theme.color.bg.surface, borderWidth: 1, borderColor: theme.color.border.subtle, padding: 14, gap: 8, justifyContent: 'space-between' },
  storyTogether: { borderColor: theme.color.together.base },
  storyTitle: { fontSize: 20, lineHeight: 24 },
});
