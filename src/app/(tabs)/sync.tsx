import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAccount, useNames } from '@/features/account/account';
import { balanceTilt, tableCards } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { useSync } from '@/features/sync/sync';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { Field } from '@/ui/Field';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

// Sunday Sync, any day of the week for testing: replay what got done, one appreciation each
// (sealed until both write), then the open table as next week's hand.
export default function SyncScreen() {
  const { state, dispatch } = useDeck();
  const names = useNames();
  const sync = useSync();
  const weekStartMs = Date.parse(`${sync.week}T00:00:00`);
  const done = state.cards.filter((c) => c.status === 'done' && c.doneAt && Date.parse(c.doneAt) >= weekStartMs);
  const table = tableCards(state);

  return (
    <Screen kicker="Sunday sync  ·  this week" title="Your week" initials={names.initials}>
      <View style={styles.center}><Seesaw tilt={balanceTilt(state)} scale={0.9} /></View>

      <Section label="1  ·  Replay">
        {done.length === 0 ? (
          <Text variant="body/lg" color={theme.color.text.secondary}>Nothing closed yet this week. That counts as a week too.</Text>
        ) : done.map((c) => (
          <View key={c.id} style={styles.row}>
            <Text variant="label/md" color={c.owner === 'together' ? theme.color.together.base : c.doneBy === 'me' ? theme.color.partner.a : theme.color.partner.b}>
              {c.owner === 'together' ? 'Both of you' : c.doneBy === 'me' ? names.me : names.partnerOr}
            </Text>
            <Text variant="title/md">{c.title}</Text>
          </View>
        ))}
      </Section>

      <Section label="2  ·  Appreciate">
        <Appreciate partner={names.partner} sync={sync} />
      </Section>

      <Section label="3  ·  Next hand">
        {table.length === 0 ? (
          <Text variant="body/md" color={theme.color.text.secondary}>The open table is clear. Nothing left hanging.</Text>
        ) : table.map((c) => (
          <View key={c.id} style={styles.row}>
            <Text variant="title/md">{c.title}</Text>
            <PopButton label="I’ll take it" tone="ghost" onPress={() => { haptics.take(); dispatch({ type: 'grab', id: c.id }); }} />
          </View>
        ))}
      </Section>

      <Text variant="caption" color={theme.color.text.muted}>{`${sync.weeks} ${sync.weeks === 1 ? 'week' : 'weeks'} in sync. A missed week pauses it, never resets it.`}</Text>

      <AccountSection />
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label/md" color={theme.color.together.base}>{label}</Text>
      {children}
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
        <Text variant="label/md" color={theme.color.partner.b}>{`${partner} noticed`}</Text>
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
      <Field label={`One thing ${partner} did this week`} value={text} onChangeText={setText} placeholder="Thanks for chasing the electrician" multiline maxLength={200} />
      <PopButton label={busy ? 'Sealing…' : 'Seal it'} tone="cream" disabled={!text.trim() || busy} onPress={save} />
      <Text variant="caption" color={theme.color.text.muted}>{`${partner} sees it only after writing theirs.`}</Text>
    </View>
  );
}

function AccountSection() {
  const { me, partner, inviteCode, signOut, leaveSpace, deleteAccount } = useAccount();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const fail = (e: unknown) => toast({ kind: 'info', title: 'That didn’t work', body: errorText(e) });
  return (
    <View style={styles.account}>
      <Text variant="label/md" color={theme.color.text.muted}>Account</Text>
      <Text variant="body/md">{`${me?.name ?? ''}${partner ? ` with ${partner.name}` : '  ·  waiting for your partner'}`}</Text>
      {inviteCode && <Text variant="body/md" color={theme.color.text.secondary}>{`Space code: ${inviteCode}`}</Text>}
      <PopButton label="Sign out" tone="ghost" onPress={() => signOut().catch(fail)} />
      <PopButton label="Leave this space" tone="ghost" onPress={() => leaveSpace().catch(fail)} />
      <PopButton
        label={confirm ? 'Tap again to delete everything of mine' : 'Delete my account'}
        tone="ghost"
        onPress={() => (confirm ? deleteAccount().catch(fail) : setConfirm(true))}
      />
      {confirm && <Text variant="caption" color={theme.color.text.muted}>Your account goes for good. Shared cards stay with your partner.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  section: { gap: 10, borderTopWidth: 1, borderTopColor: theme.color.border.subtle, paddingTop: 14 },
  row: { gap: 4 },
  reveal: { gap: 8 },
  quote: { fontSize: 24, lineHeight: 30 },
  form: { gap: 10 },
  account: { marginTop: 24, gap: 8, borderTopWidth: 1, borderTopColor: theme.color.border.subtle, paddingTop: 16 },
});
