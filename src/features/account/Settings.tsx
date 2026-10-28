import { router } from 'expo-router';
import { X } from 'phosphor-react-native';
import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { Field } from '@/ui/Field';
import { PopButton } from '@/ui/PopButton';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { useAccount } from './account';
import { ProfilePicker } from './ProfilePicker';

/** Profile, the space and the account, behind the avatar pair (never mixed into a tab). */
export function Settings() {
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
          <Text variant="title/lg">You</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <X size={22} color={theme.color.text.primary} />
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
          <PopButton label={busy ? 'Saving…' : 'Save'} tone="cream" disabled={!dirty || busy} onPress={save} />
        </Group>

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
          {confirm === 'leave' && <Text variant="caption" color={theme.color.text.muted}>{`You leave the shared deck. ${partner?.name ?? 'Your partner'} keeps the cards.`}</Text>}
          <PopButton
            label={confirm === 'delete' ? 'Tap again to delete everything of mine' : 'Delete my account'}
            tone="ghost"
            onPress={() => (confirm === 'delete' ? deleteAccount().catch(fail) : setConfirm('delete'))}
          />
          {confirm === 'delete' && <Text variant="caption" color={theme.color.text.muted}>Your account goes for good. Shared cards stay with your partner.</Text>}
        </Group>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="label/md" color={theme.color.text.muted}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.color.bg.canvas },
  body: { paddingHorizontal: 20, gap: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: theme.color.bg.surface },
  group: { gap: 12, backgroundColor: theme.color.bg.surface, borderRadius: 12, padding: 16 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { letterSpacing: 4 },
});
