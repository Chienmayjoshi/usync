import { useState } from 'react';
import { View } from 'react-native';
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
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Avatar } from '@/ui/AvatarPair';
import { Glow } from '@/ui/Glow';
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
    <Screen title="Partner" right={<HeaderAvatars />}>
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
  const t = useTheme();
  const styles = useStyles();
  const { state, thanked, askHeart } = useDeck();
  const names = useNames();
  const [weekAgo] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const glance = partnerCards(state).filter((c) => c.status !== 'waiting');
  const together = togetherCards(state).filter((c) => c.status !== 'waiting');
  const waiting = waitingCards(state);
  // Cards I dropped that nobody has decided on yet: the place to change who they are for.
  const undecided = state.cards.filter((c) => c.droppedBy === 'me' && c.status === 'deal' && c.owner !== 'me');
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
        {glance.length > 4 && <Text variant="caption" color={t.color.text.muted}>{`and ${glance.length - 4} more`}</Text>}
        <Text variant="caption" color={t.color.text.muted}>Glance only. No dates, no history.</Text>
      </View>

      {wins.length > 0 && (
        <Section label={`${names.partnerOr} got these done`} color={t.color.accent.tag}>
          {wins.map((c) => (
            <View key={c.id} style={styles.winRow}>
              <Text variant="title/md" style={styles.flex}>{c.title}</Text>
              {thanked.has(c.id)
                ? <Text variant="label/md" color={t.color.accent.tag}>Heart sent</Text>
                : <PopButton label="Send a heart" tone="gold" onPress={() => { haptics.tick(); askHeart(c); }} />}
            </View>
          ))}
        </Section>
      )}

      {undecided.length > 0 && (
        <Section label="You dropped, still undecided" hint="tap to change who it’s for">
          {undecided.map((c) => (
            <View key={c.id} style={styles.undecided}>
              <Row card={c} onPress={() => onOpen(c)} />
              <Text variant="caption" color={t.color.text.muted}>
                {c.owner === 'partner' ? `Waiting on ${names.partnerOr} to take or trade it.` : c.owner === 'together' ? 'Offered to both of you.' : 'On the open table.'}
              </Text>
            </View>
          ))}
        </Section>
      )}

      {fresh.length > 0 && (
        <Section label={`New from ${names.partnerOr}`} hint="this week">
          {fresh.map((c) => <Row key={c.id} card={c} onPress={() => onOpen(c)} />)}
        </Section>
      )}

      <Section label="Doing together" hint="on both decks" color={t.color.accent.tag}>
        {together.length
          ? together.map((c) => <Row key={c.id} card={c} onPress={() => onOpen(c)} />)
          : <Text variant="body/md" color={t.color.text.secondary}>Nothing shared right now. Swipe a card up on your deck to do it together.</Text>}
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
  const t = useTheme();
  const styles = useStyles();
  const move = useMoves();
  if (!cards.length) {
    return (
      <View style={styles.empty}>
        <Text variant="title/lg">The table is clear.</Text>
        <Text variant="body/md" color={t.color.text.secondary}>Cards land here when nobody keeps them, or when you put one here from its options. First to grab it owns it.</Text>
      </View>
    );
  }
  return (
    <>
      <Text variant="body/md" color={t.color.text.secondary}>Nobody kept these. First to grab one owns it. Still here on Sunday? They go into Sync’s next hand.</Text>
      <View style={styles.grid}>
        {cards.map((c, i) => (
          <Animated.View key={c.id} entering={FadeInDown.delay(i * 50)} layout={LinearTransition} style={styles.tableCard}>
            <Text variant="label/md" color={t.color.text.muted}>{c.bucket}</Text>
            <Text variant="display/md" style={styles.flex}>{c.title}</Text>
            <Text variant="body/sm" color={t.color.text.secondary}>{c.effort}</Text>
            <PopButton label="Grab it" tone="primary" small onPress={() => move(c, 'grab')} />
          </Animated.View>
        ))}
      </View>
    </>
  );
}

/** Every closed job, by month, as story cards. Together jobs are gold; each card carries who did it. */
function Album() {
  const t = useTheme();
  const styles = useStyles();
  const { state } = useDeck();
  const { weeks } = useSync();
  const names = useNames();
  const months: { when: string; stories: StoryCard[] }[] = [];
  for (const s of state.album) {
    const last = months[months.length - 1];
    if (last?.when === s.when) last.stories.push(s);
    else months.push({ when: s.when, stories: [s] });
  }
  const who = (s: StoryCard) => (s.together ? { label: 'Together', color: t.color.accent.tag }
    : s.doneBy === 'partner' ? { label: names.partnerOr, color: names.hex.partner } : { label: names.me, color: names.hex.me });

  return (
    <>
      <View style={styles.albumHead}>
        <Text variant="display/accent">{`${weeks} ${weeks === 1 ? 'week' : 'weeks'} in sync`}</Text>
        <Text variant="caption" color={t.color.text.muted}>A missed week pauses it, never resets it.</Text>
      </View>
      {months.length === 0 && <Text variant="body/md" color={t.color.text.secondary}>Your first finished job lands here as a story card.</Text>}
      {months.map((m) => (
        <View key={m.when} style={styles.month}>
          <Text variant="label/md" color={t.color.text.muted}>{m.when}</Text>
          <View style={styles.grid}>
            {m.stories.map((s, i) => {
              const by = who(s);
              return (
                <Animated.View
                  key={s.id}
                  entering={FadeInDown.delay(i * 50)}
                  style={styles.story}
                >
                  <Glow colors={t.tones[s.together ? 'gold' : s.doneBy === 'partner' ? names.colors.partner : names.colors.me].glow} />
                  <Text variant="label/md" color={t.color.text.muted}>{s.bucket ?? 'Story'}</Text>
                  <Text variant="display/md" style={styles.storyTitle}>{s.title}</Text>
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

function Section({ label, hint, color, children }: { label: string; hint?: string; color?: string; children: React.ReactNode }) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="label/md" color={color ?? t.color.text.muted}>{label}</Text>
        {hint && <Text variant="caption" color={t.color.text.muted}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  glance: { backgroundColor: t.color.bg.surface, borderRadius: t.radius.lg, padding: 16, gap: 10 },
  glanceHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  winRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.color.bg.raised, borderRadius: t.radius.md, padding: 14, boxShadow: t.shadow.row },
  empty: { gap: 8, paddingVertical: 24 },
  undecided: { gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tableCard: {
    width: '47.5%', minHeight: 176, backgroundColor: t.color.bg.raised, borderRadius: t.radius.lg, borderWidth: 2, borderColor: t.color.border.card,
    padding: 16, gap: 8, boxShadow: t.shadow.card,
  },
  albumHead: { gap: 4 },
  month: { gap: 10 },
  story: {
    width: '47.5%', minHeight: 140, backgroundColor: t.color.bg.raised, borderRadius: t.radius.lg, borderWidth: 2, borderColor: t.color.border.card,
    padding: 16, gap: 8, justifyContent: 'space-between', overflow: 'hidden', boxShadow: t.shadow.row,
  },
  storyTitle: { fontSize: 15, lineHeight: 18 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
