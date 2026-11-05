import { Heart } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { HeaderAvatars } from '@/features/account/HeaderAvatars';
import { useNames } from '@/features/account/account';
import { balanceTilt, type Card, partnerDeck } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useSync } from '@/features/sync/sync';
import { Legend, MonthCard, type WeekBar } from '@/features/sync/WeekBars';
import { weekStart } from '@/features/sync/weeks';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Field } from '@/ui/Field';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
import { Segmented } from '@/ui/Segmented';
import { Sheet, type SheetHandle } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

function balanceCopy(tilt: number, partner: string | null) {
  if (!partner) return 'Just you for now.';
  if (Math.abs(tilt) < 0.2) return 'Even keel this week.';
  return tilt < 0 ? 'You’re carrying more this week.' : `${partner}’s carrying more this week.`;
}

/** Sync: the week's balance, thanks for what got done, and the album of every week so far. */
export default function SyncScreen() {
  const t = useTheme();
  const s = useStyles();
  const { state } = useDeck();
  const names = useNames();
  const [view, setView] = useState<'thanks' | 'album'>('thanks');
  const tilt = balanceTilt(state);
  const on = partnerDeck(state).find((c) => c.status === 'active' && !c.request);

  return (
    <Screen title="Sync" right={<HeaderAvatars />}>
      <View style={s.balance}>
        <Text variant="title/lg" style={s.center}>{balanceCopy(tilt, names.partner)}</Text>
        {on && names.partner && <Text variant="caption" color={t.color.text.secondary} style={s.center}>{`${names.partner} is on ${on.title.toLowerCase()}`}</Text>}
        <Seesaw tilt={tilt} scale={0.8} colors={names.hex} />
        <View style={s.rule} />
      </View>
      <Segmented value={view} onChange={setView} options={[{ value: 'thanks', label: 'Thanks' }, { value: 'album', label: 'Album' }]} />
      <Animated.View key={view} entering={FadeIn.duration(220)} style={s.body}>
        {view === 'thanks' ? <Thanks /> : <Album />}
      </Animated.View>
    </Screen>
  );
}

function Thanks() {
  const t = useTheme();
  const s = useStyles();
  const { state, thanked, askHeart } = useDeck();
  const names = useNames();
  const sync = useSync();
  const [writing, setWriting] = useState(false);
  const since = Date.parse(`${sync.week}T00:00:00`);
  const done = state.cards
    .filter((c) => c.status === 'done' && c.doneBy === 'partner' && c.doneAt && Date.parse(c.doneAt) >= since)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const them = names.partnerOr;

  if (!names.partner) return <Text variant="body/md" color={t.color.text.secondary}>Thanks open once your partner joins.</Text>;

  return (
    <>
      <Text variant="label/md" color={t.color.text.secondary}>{`${them} got these done this week`}</Text>
      {done.length === 0 && <Text variant="body/md" color={t.color.text.secondary}>Nothing closed yet this week. That counts as a week too.</Text>}
      {done.map((c) => <DoneRow key={c.id} card={c} sent={thanked.has(c.id)} onSend={() => { haptics.tick(); askHeart(c); }} />)}

      <View style={s.note}>
        <Image source={require('@/../assets/illustrations/envelope.png')} style={s.envelope} resizeMode="contain" />
        <View style={s.noteCopy}>
          {sync.mine && sync.theirs ? (
            <>
              <Text variant="label/md" color={t.color.text.secondary}>{`${them} noticed`}</Text>
              <Text variant="display/accent" style={s.quote}>{`“${sync.theirs.appreciation}”`}</Text>
            </>
          ) : sync.mine ? (
            <Text variant="body/md" color={t.color.text.secondary}>{`Sealed. It opens when ${them} writes theirs, or on Monday either way.`}</Text>
          ) : (
            <>
              <Text variant="title/md">{`Appreciate one thing ${them} did this week.`}</Text>
              <Pressable onPress={() => setWriting(true)} style={s.write} accessibilityRole="button">
                <Text variant="button/sm" color={t.color.text.onColor} style={s.writeText}>Write your note</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
      {writing && <NoteSheet onClose={() => setWriting(false)} />}
    </>
  );
}

function DoneRow({ card, sent, onSend }: { card: Card; sent: boolean; onSend: () => void }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.row}>
      <Text variant="title/md" style={s.flex}>{card.title}</Text>
      {sent ? (
        <View style={s.sent}><Heart size={14} weight="fill" color={t.color.accent.heart} /><Text variant="caption" color={t.color.text.secondary}>Sent</Text></View>
      ) : (
        <Pressable onPress={onSend} style={s.send} accessibilityRole="button" accessibilityLabel={`Send a heart for ${card.title}`}>
          <Text variant="button" color={t.color.text.onColor}>Send</Text>
          <Heart size={18} weight="fill" color={t.color.accent.heart} />
        </Pressable>
      )}
    </View>
  );
}

function NoteSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const sync = useSync();
  const names = useNames();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sheet = useRef<SheetHandle>(null);
  const save = async () => {
    setBusy(true);
    try { await sync.appreciate(text); haptics.success(); sheet.current?.close(); } catch (e) { toast({ kind: 'info', title: 'That didn’t save', body: errorText(e) }); setBusy(false); }
  };
  return (
    <Sheet ref={sheet} onClose={onClose}>
      <Field label={`One thing ${names.partnerOr} did this week`} value={text} onChangeText={setText} placeholder="Thanks for chasing the electrician" multiline maxLength={200} autoFocus />
      <PopButton label={busy ? 'Sealing…' : 'Seal it'} tone="primary" disabled={!text.trim() || busy} onPress={save} />
    </Sheet>
  );
}

/** Every month so far, newest first, as weekly bars. A dot under each week: did a note go out? */
function Album() {
  const s = useStyles();
  const { state } = useDeck();
  const sync = useSync();
  const months = new Map<string, Date>();
  for (const a of state.album) if (a.doneAt) { const d = new Date(a.doneAt); months.set(`${d.getFullYear()}-${d.getMonth()}`, new Date(d.getFullYear(), d.getMonth(), 1)); }
  const now = new Date();
  months.set(`${now.getFullYear()}-${now.getMonth()}`, new Date(now.getFullYear(), now.getMonth(), 1));
  const noted = new Set(sync.entries.filter((e) => e.member === sync.me).map((e) => e.week_start));
  const thisWeek = weekStart();

  const cards = [...months.values()].sort((a, b) => b.getTime() - a.getTime()).map((first) => {
    const weeks: WeekBar[] = [];
    for (let d = new Date(first); d.getMonth() === first.getMonth(); d.setDate(d.getDate() + 7)) {
      const start = new Date(d);
      const end = new Date(d); end.setDate(end.getDate() + 7);
      const count = state.album.filter((a) => a.doneAt && Date.parse(a.doneAt) >= start.getTime() && Date.parse(a.doneAt) < end.getTime() && new Date(a.doneAt).getMonth() === first.getMonth()).length;
      const wk = weekStart(start);
      const past = wk < thisWeek;
      weeks.push({ label: `W${weeks.length + 1}`, count, note: noted.has(wk) ? 'added' : past && start <= now ? 'missed' : null });
    }
    return { key: first.toISOString(), month: first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase(), total: weeks.reduce((n, w) => n + w.count, 0), weeks };
  });

  return (
    <>
      <View style={s.albumHead}>
        <Text variant="title/lg">{`${sync.weeks} ${sync.weeks === 1 ? 'week' : 'weeks'} in sync`}</Text>
        <Legend />
      </View>
      {cards.map((c) => <MonthCard key={c.key} month={c.month} total={c.total} weeks={c.weeks} />)}
    </>
  );
}

const useStyles = makeStyles((t) => ({
  balance: { alignItems: 'center', gap: 2 },
  rule: { alignSelf: 'stretch', height: 1, backgroundColor: t.color.text.primary, opacity: 0.6, marginTop: -6 },
  center: { textAlign: 'center' },
  body: { gap: 10 },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.color.bg.sync, borderRadius: t.radius.md,
    borderWidth: 2, borderColor: t.color.border.card, paddingLeft: 14, paddingRight: 8, minHeight: 64, boxShadow: t.shadow.row,
  },
  send: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.color.action.neutral, borderRadius: t.radius.full, paddingHorizontal: 18, height: 40, borderWidth: 2, borderColor: t.color.border.card },
  sent: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.color.bg.raised, borderRadius: t.radius.lg,
    borderWidth: 1, borderColor: t.color.border.subtle, padding: 14, marginTop: 6, boxShadow: t.shadow.card,
  },
  envelope: { width: 80, height: 76 },
  noteCopy: { flex: 1, gap: 8 },
  quote: { fontSize: 18, lineHeight: 24 },
  write: { alignSelf: 'flex-start', backgroundColor: '#ED847F', borderRadius: t.radius.full, paddingHorizontal: 16, paddingVertical: 6 },
  writeText: { textTransform: 'none', fontSize: 15 },
  albumHead: { gap: 6 },
}));
