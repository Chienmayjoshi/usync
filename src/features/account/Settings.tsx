import { router } from 'expo-router';
import { CaretRight, X } from 'phosphor-react-native';
import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/features/mascot/Mascot';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { makeStyles, type ThemePref, useTheme, useThemePref } from '@/theme/ThemeProvider';
import { Field } from '@/ui/Field';
import { PopButton } from '@/ui/PopButton';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { useAccount, useNames } from './account';
import { ProfilePicker } from './ProfilePicker';

/** Profile, the space and the account, behind the avatar pair (never mixed into a tab). */
export function Settings() {
  const t = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { me, partner, inviteCode, saveProfile, signOut, leaveSpace, deleteAccount } = useAccount();
  const toast = useToast();
  const [name, setName] = useState(me?.name ?? '');
  const [look, setLook] = useState({ color: me?.color ?? 'ember', avatar: me?.avatar ?? null });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const fail = (e: unknown) => toast({ kind: 'info', title: 'That didn’t work', body: errorText(e) });
  const dirty = !!name.trim() && (name.trim() !== me?.name || look.color !== me?.color || look.avatar !== (me?.avatar ?? null));

  const save = async () => {
    setBusy(true);
    try {
      await saveProfile({ name, ...look });
      haptics.success();
      toast({ kind: 'info', title: 'Saved', body: partner ? `${partner.name} sees it right away.` : 'Your partner sees it when they join.', ms: 2500 });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const share = () => inviteCode && Share.share({ message: `Join me on usync so we can share the life admin. Open the app and enter this code: ${inviteCode}` }).catch(() => undefined);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text variant="display/lg">Settings</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <X size={22} color={t.color.text.primary} />
          </Pressable>
        </View>

        <Group label="Profile">
          <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" maxLength={24} />
          <ProfilePicker
            value={look}
            onChange={setLook}
            initial={name.trim().charAt(0).toUpperCase() || null}
            partnerColor={partner?.color ?? null}
            partnerName={partner?.name}
          />
          <PopButton label={busy ? 'Saving…' : 'Save'} tone="primary" disabled={!dirty || busy} onPress={save} />
        </Group>

        <Nudges />

        <Appearance />

        <Group label="Your space">
          <Text variant="body/lg">{partner ? `You and ${partner.name}` : 'Waiting for your partner to join'}</Text>
          {inviteCode && (
            <View style={styles.codeRow}>
              <Text variant="title/lg" style={styles.code}>{inviteCode}</Text>
              {!partner && <PopButton label="Share code" tone="ghost" onPress={share} />}
            </View>
          )}
        </Group>

        <Group label="Account">
          <PopButton label="Sign out" tone="ghost" onPress={() => signOut().catch(fail)} />
          <PopButton
            label={confirm === 'leave' ? 'Tap again to leave' : 'Leave this space'}
            tone="ghost"
            onPress={() => (confirm === 'leave' ? leaveSpace().catch(fail) : setConfirm('leave'))}
          />
          {confirm === 'leave' && <Text variant="caption" color={t.color.text.muted}>{`You leave the shared deck. ${partner?.name ?? 'Your partner'} keeps the cards.`}</Text>}
          <PopButton
            label={confirm === 'delete' ? 'Tap again to delete everything of mine' : 'Delete my account'}
            tone="ghost"
            onPress={() => (confirm === 'delete' ? deleteAccount().catch(fail) : setConfirm('delete'))}
          />
          {confirm === 'delete' && <Text variant="caption" color={t.color.text.muted}>Your account goes for good. Shared cards stay with your partner.</Text>}
        </Group>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const FIRMNESS: { value: '1' | '2' | '3'; label: string }[] = [
  { value: '1', label: 'Gentle' },
  { value: '2', label: 'Cheeky' },
  { value: '3', label: 'Firm' },
];

/**
 * Mascot nudges: the mascot you show your partner, and how firm theirs may get with you.
 * Nudges are private: neither of you is told when the other's mascot spoke.
 */
function Nudges() {
  const t = useTheme();
  const styles = useStyles();
  const { me, partner, saveProfile } = useAccount();
  const names = useNames();
  const toast = useToast();
  const them = partner?.name ?? 'Your partner';
  const cap = String(me?.nudge_max ?? 2) as '1' | '2' | '3';
  const setCap = (v: '1' | '2' | '3') => saveProfile({ nudge_max: Number(v) })
    .catch((e) => toast({ kind: 'info', title: 'That didn’t work', body: errorText(e) }));
  return (
    <Group label="Nudges">
      <Pressable onPress={() => router.push('/mascot')} accessibilityRole="button" accessibilityLabel="Edit your mascot" style={styles.mascotRow}>
        <Mascot recipe={me?.mascot} mood="cheeky" size={56} bg={t.tones[names.colors.me].glow[0]} />
        <View style={styles.flex}>
          <Text variant="title/md">Your mascot</Text>
          <Text variant="caption" color={t.color.text.secondary}>{me?.mascot ? `${them} gets nudges from this one.` : `Make the face ${them} sees when a task sits too long.`}</Text>
        </View>
        <CaretRight size={18} color={t.color.text.muted} />
      </Pressable>
      <Text variant="body/md">{`How firm can ${partner ? `${partner.name}’s` : 'your partner’s'} mascot get with you?`}</Text>
      <Segmented value={cap} onChange={setCap} options={FIRMNESS} />
      <Text variant="caption" color={t.color.text.muted}>Nudges come after 3 days, get cheekier after 6 and firm after 10, never past this. They stay between you and the mascot.</Text>
      <Text variant="caption" color={t.color.text.muted}>Mascots: Open Peeps by Pablo Stanley (CC0).</Text>
    </Group>
  );
}

const MODES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light, dark or follow the phone. Saved on this phone only. */
function Appearance() {
  const t = useTheme();
  const { pref, setPref } = useThemePref();
  return (
    <Group label="Appearance">
      <Segmented value={pref} onChange={setPref} options={MODES} />
      <Text variant="caption" color={t.color.text.muted}>
        {pref === 'system' ? 'Follows your phone’s light or dark setting.' : 'Only changes this phone. Your partner keeps their own.'}
      </Text>
    </Group>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Text variant="label/md" color={t.color.text.muted}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.color.bg.canvas },
  body: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: t.color.bg.surface },
  group: { gap: 12, backgroundColor: t.color.bg.surface, borderRadius: t.radius.lg, padding: 18 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  code: { letterSpacing: 4 },
}));
