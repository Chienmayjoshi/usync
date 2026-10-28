import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { HeaderAvatars } from '@/features/account/HeaderAvatars';
import { useNames } from '@/features/account/account';
import { balanceTilt, type Card, tableCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { useSync } from '@/features/sync/sync';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { Field } from '@/ui/Field';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

type Step = 'replay' | 'appreciate' | 'next';
const STEPS: { value: Step; label: string }[] = [
  { value: 'replay', label: '1 Replay' },
  { value: 'appreciate', label: '2 Thanks' },
  { value: 'next', label: '3 Next' },
];

// Sunday Sync, any day of the week: replay what got done, one appreciation each (sealed until
// both write), then the open table as next week's hand. One step on screen at a time.
export default function SyncScreen() {
  const { state } = useDeck();
  const names = useNames();
  const sync = useSync();
  const [step, setStep] = useState<Step>('replay');
  const at = STEPS.findIndex((s) => s.value === step);
  const next = STEPS[at + 1];

  return (
    <Screen kicker="Sunday sync  ·  this week" title="Your week" right={<HeaderAvatars />}>
      <View style={styles.center}><Seesaw tilt={balanceTilt(state)} scale={0.7} colors={names.hex} /></View>
      <Segmented value={step} onChange={setStep} options={STEPS} accent={theme.color.together.base} />

      <Animated.View key={step} entering={FadeIn.duration(220)} style={styles.step}>
        {step === 'replay' && <Replay week={sync.week} />}
        {step === 'appreciate' && <Appreciate partner={names.partner} sync={sync} />}
        {step === 'next' && <NextHand />}
      </Animated.View>

      {next && <PopButton label={`Next: ${next.label.slice(2)}`} tone="ghost" onPress={() => { haptics.tick(); setStep(next.value); }} />}
      <Text variant="caption" color={theme.color.text.muted} style={styles.centerText}>{`${sync.weeks} ${sync.weeks === 1 ? 'week' : 'weeks'} in sync. A missed week pauses it, never resets it.`}</Text>
    </Screen>
  );
}

const SHOW = 4;

/** The week's closed jobs, by who carried them. Long weeks fold, so the step stays one screen. */
function Replay({ week }: { week: string }) {
  const { state } = useDeck();
  const names = useNames();
  const [open, setOpen] = useState<string | null>(null);
  const weekStartMs = Date.parse(`${week}T00:00:00`);
  const done = state.cards.filter((c) => c.status === 'done' && c.doneAt && Date.parse(c.doneAt) >= weekStartMs);
  if (done.length === 0) return <Text variant="body/lg" color={theme.color.text.secondary}>Nothing closed yet this week. That counts as a week too.</Text>;

  const groups: { key: string; label: string; color: string; cards: Card[] }[] = [
    { key: 'together', label: 'Both of you', color: theme.color.together.base, cards: done.filter((c) => c.owner === 'together') },
    { key: 'partner', label: names.partnerOr, color: names.hex.partner, cards: done.filter((c) => c.owner !== 'together' && c.doneBy === 'partner') },
    { key: 'me', label: names.me, color: names.hex.me, cards: done.filter((c) => c.owner !== 'together' && c.doneBy !== 'partner') },
  ];
  return (
    <View style={styles.groups}>
      {groups.filter((g) => g.cards.length).map((g) => {
        const all = open === g.key;
        return (
          <View key={g.key} style={[styles.group, { borderLeftColor: g.color }]}>
            <Text variant="label/md" color={g.color}>{g.label}</Text>
            {(all ? g.cards : g.cards.slice(0, SHOW)).map((c) => <Text key={c.id} variant="title/md">{c.title}</Text>)}
            {g.cards.length > SHOW && (
              <PopButton label={all ? 'Fold' : 'Show all'} tone="ghost" onPress={() => setOpen(all ? null : g.key)} style={styles.fold} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function Appreciate({ partner, sync }: { partner: string | null; sync: ReturnType<typeof useSync> }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!partner) return <Text variant="body/md" color={theme.color.text.secondary}>Opens once your partner joins.</Text>;
  if (sync.mine && sync.theirs) {
    return (
      <View style={styles.reveal}>
        <Text variant="label/md" color={theme.color.together.base}>{`${partner} noticed`}</Text>
        <Text variant="display/accent" style={styles.quote}>{`“${sync.theirs.appreciation}”`}</Text>
        <Text variant="caption" color={theme.color.text.muted}>{`You wrote: “${sync.mine.appreciation}”`}</Text>
      </View>
    );
  }
  if (sync.mine) {
    return <Text variant="body/md" color={theme.color.text.secondary}>{`Sealed. It opens when ${partner} writes theirs, or on Monday either way.`}</Text>;
  }
  const save = async () => {
    setBusy(true);
    try { await sync.appreciate(text); haptics.success(); } catch (e) { toast({ kind: 'info', title: 'That didn’t save', body: errorText(e) }); } finally { setBusy(false); }
  };
  return (
    <View style={styles.form}>
      <Text variant="body/md" color={theme.color.text.secondary}>{`The one thing from this week you want ${partner} to know you saw. Hearts for single jobs go out any day from Us.`}</Text>
      <Field label={`One thing ${partner} did this week`} value={text} onChangeText={setText} placeholder="Thanks for chasing the electrician" multiline maxLength={200} />
      <PopButton label={busy ? 'Sealing…' : 'Seal it'} tone="cream" disabled={!text.trim() || busy} onPress={save} />
      <Text variant="caption" color={theme.color.text.muted}>{`${partner} sees it only after writing theirs.`}</Text>
    </View>
  );
}

function NextHand() {
  const { state } = useDeck();
  const move = useMoves();
  const table = tableCards(state);
  if (table.length === 0) return <Text variant="body/md" color={theme.color.text.secondary}>The open table is clear. Nothing left hanging.</Text>;
  return (
    <View style={styles.groups}>
      <Text variant="body/md" color={theme.color.text.secondary}>Still on the open table. Pick what you’ll carry next week.</Text>
      {table.map((c) => (
        <View key={c.id} style={styles.nextRow}>
          <Text variant="title/md" style={styles.flex}>{c.title}</Text>
          <PopButton label="I’ll take it" tone="ghost" onPress={() => move(c, 'grab')} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  flex: { flex: 1 },
  step: { gap: 12, minHeight: 160 },
  groups: { gap: 12 },
  group: { gap: 6, borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 2 },
  fold: { alignSelf: 'flex-start' },
  reveal: { gap: 8 },
  quote: { fontSize: 24, lineHeight: 30 },
  form: { gap: 10 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.color.bg.surface, paddingLeft: 14, paddingVertical: 4 },
});
