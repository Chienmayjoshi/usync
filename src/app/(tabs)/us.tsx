import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { HeaderAvatars } from '@/features/account/HeaderAvatars';
import { useNames } from '@/features/account/account';
import { CardActions } from '@/features/deck/CardActions';
import { Row } from '@/features/deck/CardList';
import { type Card, partnerCards, type StoryCard, tableCards, togetherCards, waitingCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { useSync } from '@/features/sync/sync';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { haptics } from '@/theme/haptics';
import { theme, tones } from '@/theme/tokens';
import { Avatar } from '@/ui/AvatarPair';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';

type View3 = 'now' | 'table' | 'album';

export default function UsScreen() {
  const { state } = useDeck();
  const [view, setView] = useState<View3>('now');
  const [options, setOptions] = useState<Card | null>(null);
  const [updating, setUpdating] = useState<Card | null>(null);
  const table = tableCards(state);

  return (
    <Screen kicker="Us" title="The two of you" right={<HeaderAvatars />}>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'now', label: 'Now' },
          { value: 'table', label: table.length ? `Table  ·  ${table.length}` : 'Table' },
          { value: 'album', label: 'Album' },
        ]}
      />
      {view === 'now' && <Now onOpen={setOptions} />}
      {view === 'table' && <Table cards={table} />}
      {view === 'album' && <Album />}
      {options && <CardActions card={options} onClose={() => setOptions(null)} onUpdate={setUpdating} />}
      {updating && <UpdateSheet card={updating} onClose={() => setUpdating(null)} />}
    </Screen>
  );
}

/** What is happening between you this week: their deck at a glance, their drops, shared jobs, wins to thank. */
function Now({ onOpen }: { onOpen: (c: Card) => void }) {
  const { state, thanked, askHeart } = useDeck();
  const names = useNames();
  const [weekAgo] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const glance = partnerCards(state).filter((c) => c.status !== 'waiting');
  const together = togetherCards(state).filter((c) => c.status !== 'waiting');
  const waiting = waitingCards(state);
  const fresh = state.cards.filter((c) => c.droppedBy === 'partner' && c.status !== 'done' && c.createdAt && Date.parse(c.createdAt) > weekAgo);
  const wins = state.cards
    .filter((c) => c.status === 'done' && c.doneBy === 'partner' && c.doneAt && Date.parse(c.doneAt) > weekAgo)
    .sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''));

  return (
    <>
      <View style={styles.glance}>
        <View style={styles.glanceHead}>
          {names.partner && <Avatar initial={names.initials.b} avatar={names.avatars.b} color={names.colors.partner} size={32} />}
          <Text variant="label/md" color={names.hex.partner} style={styles.flex}>{names.partner ? `${names.partner}’s on` : 'Your partner hasn’t joined yet'}</Text>
        </View>
        {glance.length ? glance.slice(0, 4).map((c) => (
          <View key={c.id} style={styles.glanceRow}>
            <View style={[styles.dot, { backgroundColor: names.hex.partner }]} />
            <Text variant="body/md" style={styles.flex}>{c.title}</Text>
          </View>
        )) : <Text variant="body/md">Nothing right now. A rare calm.</Text>}
        {glance.length > 4 && <Text variant="caption" color={theme.color.text.muted}>{`and ${glance.length - 4} more`}</Text>}
        <Text variant="caption" color={theme.color.text.muted}>Glance only. No dates, no history.</Text>
      </View>

      {wins.length > 0 && (
        <Section label={`${names.partnerOr} got these done`} color={theme.color.together.base}>
          {wins.map((c) => (
            <View key={c.id} style={styles.winRow}>
              <Text variant="title/md" style={styles.flex}>{c.title}</Text>
              {thanked.has(c.id)
                ? <Text variant="label/md" color={theme.color.together.base}>Heart sent</Text>
                : <PopButton label="Send a heart" tone="gold" onPress={() => { haptics.tick(); askHeart(c); }} />}
            </View>
          ))}
        </Section>
      )}

      {fresh.length > 0 && (
        <Section label={`New from ${names.partnerOr}`} hint="this week">
          {fresh.map((c) => <Row key={c.id} card={c} onPress={() => onOpen(c)} />)}
        </Section>
      )}

      <Section label="Doing together" hint="on both decks" color={theme.color.together.base}>
        {together.length
          ? together.map((c) => <Row key={c.id} card={c} onPress={() => onOpen(c)} />)
          : <Text variant="body/md" color={theme.color.text.secondary}>Nothing shared right now. Swipe a card up on your deck to do it together.</Text>}
      </Section>

      {waiting.length > 0 && (
        <Section label="Waiting on others" hint="never counts as a slip">
          {waiting.map((c) => <Row key={c.id} card={c} onPress={() => onOpen(c)} />)}
        </Section>
      )}
    </>
  );
}

/** The open table as cards on a table: two across, grab one and it moves to your deck. */
function Table({ cards }: { cards: Card[] }) {
  const move = useMoves();
  if (!cards.length) {
    return (
      <View style={styles.empty}>
        <Text variant="title/lg">The table is clear.</Text>
        <Text variant="body/md" color={theme.color.text.secondary}>Cards land here when nobody keeps them, or when you put one here from its options. First to grab it owns it.</Text>
      </View>
    );
  }
  return (
    <>
      <Text variant="body/md" color={theme.color.text.secondary}>Nobody kept these. First to grab one owns it. Still here on Sunday? They go into Sync’s next hand.</Text>
      <View style={styles.grid}>
        {cards.map((c, i) => (
          <Animated.View key={c.id} entering={FadeInDown.delay(i * 50)} layout={LinearTransition} style={styles.tableCard}>
            <Text variant="label/md" color={theme.color.text.muted}>{c.bucket}</Text>
            <Text variant="title/md" style={styles.flex}>{c.title}</Text>
            <Text variant="caption" color={theme.color.text.secondary}>{c.effort}</Text>
            <PopButton label="Grab it" tone="cream" onPress={() => move(c, 'grab')} />
          </Animated.View>
        ))}
      </View>
    </>
  );
}

/** Every closed job, by month, as story cards. Together jobs are gold; each card carries who did it. */
function Album() {
  const { state } = useDeck();
  const { weeks } = useSync();
  const names = useNames();
  const months: { when: string; stories: StoryCard[] }[] = [];
  for (const s of state.album) {
    const last = months[months.length - 1];
    if (last?.when === s.when) last.stories.push(s);
    else months.push({ when: s.when, stories: [s] });
  }
  const who = (s: StoryCard) => (s.together ? { label: 'Together', color: theme.color.together.base }
    : s.doneBy === 'partner' ? { label: names.partnerOr, color: names.hex.partner } : { label: names.me, color: names.hex.me });

  return (
    <>
      <View style={styles.albumHead}>
        <Text variant="display/accent">{`${weeks} ${weeks === 1 ? 'week' : 'weeks'} in sync`}</Text>
        <Text variant="caption" color={theme.color.text.muted}>A missed week pauses it, never resets it.</Text>
      </View>
      {months.length === 0 && <Text variant="body/md" color={theme.color.text.secondary}>Your first finished job lands here as a story card.</Text>}
      {months.map((m) => (
        <View key={m.when} style={styles.month}>
          <Text variant="label/md" color={theme.color.text.muted}>{m.when}</Text>
          <View style={styles.grid}>
            {m.stories.map((s, i) => {
              const by = who(s);
              return (
                <Animated.View
                  key={s.id}
                  entering={FadeInDown.delay(i * 50)}
                  style={[styles.story, { borderColor: s.together ? theme.color.together.base : theme.color.border.subtle }, s.together && { backgroundColor: theme.color.bg.raised }]}
                >
                  <Text variant="label/md" color={theme.color.text.muted}>{s.bucket ?? 'Story'}</Text>
                  <Text variant="display/accent" style={styles.storyTitle}>{s.title}</Text>
                  <View style={styles.byline}>
                    <View style={[styles.dot, { backgroundColor: by.color }]} />
                    <Text variant="label/md" color={by.color}>{by.label}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </View>
      ))}
    </>
  );
}

function Section({ label, hint, color = theme.color.text.muted, children }: { label: string; hint?: string; color?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="label/md" color={color}>{label}</Text>
        {hint && <Text variant="caption" color={theme.color.text.muted}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  glance: { backgroundColor: theme.color.bg.surface, borderRadius: 12, padding: 14, gap: 8 },
  glanceHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  winRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: theme.color.together.edge, padding: 12 },
  empty: { gap: 8, paddingVertical: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tableCard: { width: '47.5%', minHeight: 168, backgroundColor: theme.color.bg.raised, borderWidth: 1.5, borderColor: tones.neutral.edge, padding: 14, gap: 8 },
  albumHead: { gap: 4 },
  month: { gap: 10 },
  story: { width: '47.5%', minHeight: 132, backgroundColor: theme.color.bg.surface, borderWidth: 1.5, padding: 14, gap: 8, justifyContent: 'space-between' },
  storyTitle: { fontSize: 19, lineHeight: 24 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
