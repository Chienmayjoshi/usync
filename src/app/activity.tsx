import { router } from 'expo-router';
import { ArrowBendUpLeft, Bell, Cards, CheckCircle, Gift, Hand, Handshake, Heart, PlusSquare, Prohibit, X } from 'phosphor-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useNames } from '@/features/account/account';
import { useFocus } from '@/features/deck/focus';
import type { Card } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { MOOD_FOR, type NudgeLevel } from '@/features/mascot/lines';
import { Mascot } from '@/features/mascot/Mascot';
import { useActivity } from '@/features/notify/activity';
import { type Entry, groupActivity, liveStatus, type Status, type Tone } from '@/features/notify/where';
import { Appreciate } from '@/features/thanks/Appreciate';
import { reactionOf } from '@/features/thanks/reactions';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { haptics } from '@/theme/haptics';
import { Text } from '@/ui/Text';

function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = new Date(iso);
  return Math.round(h / 24) < 7 ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Behind the bell (Figma 286:7199): what waits on me first, then today and earlier. Every row says
 * what its card is doing now, answers small things in place, and a tap goes where the card lives.
 */
export default function ActivityScreen() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { items, markSeen, seen } = useActivity();
  const { state, reacted } = useDeck();
  const names = useNames();
  // Opening the list reads it; the dot clears once you leave.
  useEffect(() => () => markSeen(), [markSeen]);
  // Answered here: the row stays where it was until next time, so nothing jumps under the finger.
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [now] = useState(Date.now);

  const ctx = { cards: state.cards, partner: names.partnerOr, reacted, now };
  const statusOf = (e: Entry) => liveStatus({ ...e.item, data: { ...e.item.data, task_ids: e.ids } }, ctx);
  const groups = groupActivity(items, (i) => answered.has(i.id) || !!liveStatus(i, ctx)?.pending, now);
  const row = (e: Entry) => (
    <Row key={e.key} entry={e} status={statusOf(e)} fresh={!seen || e.item.created_at > seen} onAnswered={() => setAnswered((a) => new Set(a).add(e.item.id))} />
  );

  return (
    <View style={[s.fill, { paddingTop: insets.top + 12 }]}>
      <View style={s.header}>
        <Text variant="display/xl">ACTIVITY</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={s.close}>
          <X size={20} color={t.color.text.primary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 40 }]}>
        {items.length === 0 && (
          <View style={s.empty}>
            <Bell size={40} color={t.color.text.placeholder} weight="fill" />
            <Text variant="title/lg">All quiet.</Text>
            <Text variant="body/md" color={t.color.text.secondary} style={s.center}>Asks, hearts, new cards and nudges show up here.</Text>
          </View>
        )}
        <Section label={`NEEDS YOU  ·  ${groups.needs.length}`} entries={groups.needs} row={row} />
        <Section label="TODAY" entries={groups.today} row={row} />
        <Section label="EARLIER" entries={groups.earlier} row={row} />
      </ScrollView>
    </View>
  );
}

/** Figma 285:24911: a label and its rows, 8 apart; sections sit 20 apart. */
function Section({ label, entries, row }: { label: string; entries: Entry[]; row: (e: Entry) => ReactNode }) {
  const t = useTheme();
  const s = useStyles();
  if (!entries.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.label} color={t.color.text.secondary}>{label}</Text>
      {entries.map(row)}
    </View>
  );
}

/** Figma 286:7303: the new cards on one line, the last one fading out under the edge. */
function Chips({ cards, extra }: { cards: Card[]; extra: number }) {
  const t = useTheme();
  const s = useStyles();
  const bg = t.color.bg.surface;
  return (
    <View style={s.chips}>
      {cards.map((c) => <View key={c.id} style={s.chip}><Text style={s.chipText} numberOfLines={1}>{c.title}</Text></View>)}
      {extra > 0 && <View style={s.chip}><Text style={s.chipText}>{`+${extra}`}</Text></View>}
      <Svg style={s.fade} width={12} height={26} pointerEvents="none">
        <Defs>
          <LinearGradient id="chipFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={bg} stopOpacity={0} />
            <Stop offset="0.95" stopColor={bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width={12} height={26} fill="url(#chipFade)" />
      </Svg>
    </View>
  );
}

function Row({ entry, status, fresh, onAnswered }: { entry: Entry; status: Status | null; fresh: boolean; onAnswered: () => void }) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const { state } = useDeck();
  const { open } = useFocus();
  const move = useMoves();
  const { item, ids } = entry;
  const cards = ids.map((id) => state.cards.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const card = cards[0];
  const gone = status?.label === 'No longer here';
  const pending = !!status?.pending;
  const tone: Record<Tone, string> = {
    pending: t.color.accent.tag, alert: t.color.accent.heart, partner: t.tones[names.colors.partner].ink,
    muted: t.color.text.placeholder, ok: t.color.text.secondary,
  };

  // What it said then, and what it says now (merged drops read as one).
  const title = item.kind === 'drop' && entry.merged > 1 ? `${names.partnerOr} added ${ids.length} cards` : item.title;
  const body = item.kind === 'done' || (item.kind === 'drop' && entry.merged > 1) ? null : item.body;

  // Rows with buttons in them are answered in place; a tap on the row itself would fight the buttons.
  const tap = gone || pending || status?.action ? undefined : () => { open(item.kind, { ...item.data, task_ids: ids }); };
  return (
    <Pressable
      onPress={tap}
      disabled={!tap}
      style={({ pressed }) => [s.row, pending ? s.rowPending : s.rowSettled, gone && s.gone, pressed && tap && s.pressed]}
      accessibilityRole={tap ? 'button' : undefined}
      accessibilityHint={tap ? 'Opens where this card is now' : undefined}
    >
      <Lead kind={item.kind} card={card} pending={pending} gone={gone} level={item.data?.level} reaction={item.data?.reaction} surprise={!!item.data?.surprise} yes={item.data?.yes} />
      <View style={s.copy}>
        <Text style={s.title} color={t.color.text.primary}>{title}</Text>
        {!!body && <Text style={s.body} color={t.color.text.secondary}>{body}</Text>}
        {item.kind === 'drop' && entry.merged > 1 && <Chips cards={cards.slice(0, 2)} extra={ids.length - Math.min(2, cards.length)} />}
        {/* An ask's buttons say it waits on you (Figma 286:7206), so no line above them. */}
        {!!status?.label && status.action !== 'answer' && <Text style={s.status} color={tone[status.tone]}>{status.label}</Text>}
        {status?.action === 'answer' && card?.request && (
          <View style={s.actions}>
            <Answer label={card.request === 'take' ? 'Not this one' : card.request === 'together' ? 'Not now' : 'Keep it'} onPress={() => { onAnswered(); move(card, 'decline'); }} />
            <Answer primary label={card.request === 'take' ? 'Take it' : card.request === 'together' ? 'Yes, together' : 'Give it'} onPress={() => { onAnswered(); move(card, 'accept'); }} />
          </View>
        )}
        {status?.action === 'appreciate' && card && <View style={s.actions}><Appreciate card={card} /></View>}
      </View>
      <View style={s.meta}>
        <Text style={s.time} color={t.color.text.muted}>{ago(item.created_at)}</Text>
        {fresh && <View style={[s.dot, { backgroundColor: t.color.accent.heart }]} />}
      </View>
    </Pressable>
  );
}

/** Figma "Activity/Button": a 36 tall pill, black for yes, white with a hairline for no. */
function Answer({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={() => { haptics.tick(); onPress(); }} hitSlop={4} accessibilityRole="button"
      style={({ pressed }) => [s.answer, primary ? { backgroundColor: t.color.action.primary } : s.answerGhost, pressed && { transform: [{ scale: 0.97 }] }]}>
      <Text style={s.answerText} color={primary ? t.color.action.onPrimary : t.color.text.primary}>{label}</Text>
    </Pressable>
  );
}

/** The round lead on a row: her mascot when she is asking or nudging, otherwise an icon. */
function Lead({ kind, card, pending, gone, level, reaction, surprise, yes }: {
  kind: string; card?: Card; pending: boolean; gone: boolean; level?: number; reaction?: string; surprise: boolean; yes?: boolean;
}) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const bg = t.tones[names.colors.partner].glow[0];
  if (!gone && kind === 'request' && pending) return <Mascot recipe={names.mascots.partner} mood="asking" size={40} bg={bg} />;
  if (!gone && kind === 'nudge') return <Mascot recipe={names.mascots.partner} mood={MOOD_FOR[(Math.min(3, Math.max(1, level ?? 1))) as NudgeLevel]} size={40} bg={bg} />;
  let icon: ReactNode;
  if (gone) icon = <Prohibit size={20} weight="fill" color={t.color.text.placeholder} />;
  else if (kind === 'thanks' && reaction && reaction !== 'heart') icon = <Text style={s.leadEmoji}>{reactionOf(reaction).emoji}</Text>;
  else {
    const map: Record<string, ReactNode> = {
      request: <Hand size={20} weight="fill" color={t.color.accent.tag} />,
      answer: yes === false || card?.owner === 'table'
        ? <ArrowBendUpLeft size={20} weight="fill" color={t.color.text.secondary} />
        : <Handshake size={20} weight="fill" color={t.tones[names.colors.partner].ink} />,
      drop: <PlusSquare size={20} weight="fill" color={t.color.text.primary} />,
      hand: <Cards size={20} weight="fill" color={t.color.text.primary} />,
      done: surprise ? <Gift size={20} weight="fill" color={t.color.accent.highlight} /> : <CheckCircle size={20} weight="fill" color={t.color.accent.tag} />,
      thanks: <Heart size={20} weight="fill" color={t.color.accent.heart} />,
      sync: <Bell size={20} weight="fill" color={t.color.text.primary} />,
    };
    icon = map[kind] ?? <Bell size={20} weight="fill" color={t.color.text.primary} />;
  }
  return <View style={s.icon}>{icon}</View>;
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.color.bg.canvas },
  // Figma 286:7200: the title row, 8 under it, then 20 to the first section.
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: t.color.bg.surface },
  // Figma 286:7199: 20 between sections; inside one, 8 between the label and each row.
  list: { paddingHorizontal: 20, gap: 20, paddingTop: 20 },
  section: { gap: 8 },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 140 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, padding: 16 },
  // Waiting on me: lifted, white, a hairline and a soft drop. Settled rows sit flat in grey.
  rowPending: { backgroundColor: t.color.bg.raised, borderWidth: 1, borderColor: t.scheme === 'light' ? '#E4E4E4' : t.color.border.strong, boxShadow: '0px 4px 12px 0px rgba(0,0,0,0.06)' },
  rowSettled: { backgroundColor: t.color.bg.surface },
  gone: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.bg.raised, borderWidth: 1, borderColor: t.color.border.subtle },
  leadEmoji: { fontSize: 20, lineHeight: 24 },
  copy: { flex: 1, gap: 8 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 15, lineHeight: 20 },
  body: { fontFamily: 'Satoshi-Regular', fontSize: 13, lineHeight: 18 },
  status: { fontFamily: 'Satoshi-Bold', fontSize: 12, lineHeight: 16 },
  chips: { flexDirection: 'row', gap: 6, overflow: 'hidden', alignSelf: 'stretch' },
  fade: { position: 'absolute', right: 0, top: 0 },
  chip: { flexShrink: 0, borderRadius: 20, borderWidth: 1, borderColor: t.scheme === 'light' ? '#E4E4E4' : t.color.border.strong, backgroundColor: t.color.bg.raised, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 160 },
  chipText: { fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 16 },
  // Figma 286:7229: 6 above the buttons, 8 between them.
  actions: { flexDirection: 'row', gap: 8, paddingTop: 6 },
  answer: { borderRadius: 40, paddingHorizontal: 16, paddingVertical: 8 },
  answerGhost: { backgroundColor: t.color.bg.raised, borderWidth: 1, borderColor: t.color.border.strong },
  answerText: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 20 },
  meta: { alignItems: 'flex-end', gap: 8, paddingVertical: 3 },
  time: { fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
}));
