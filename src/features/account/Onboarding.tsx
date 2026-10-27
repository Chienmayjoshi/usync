import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { Field } from '@/ui/Field';
import { PopButton } from '@/ui/PopButton';
import { Text } from '@/ui/Text';

import { useAccount } from './account';

/** Shared shell for the three setup steps: one question per screen, keyboard safe. */
function Step({ kicker, title, body, children }: { kicker: string; title: string; body: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text variant="label/md" color={theme.color.partner.a}>{kicker}</Text>
        <Text variant="display/lg">{title}</Text>
        <Text variant="body/lg" color={theme.color.text.secondary}>{body}</Text>
        <View style={styles.form}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); haptics.success(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

const Err = ({ text }: { text: string | null }) => (text ? <Text variant="body/md" color={theme.color.together.base}>{text}</Text> : null);

export function SignInStep() {
  const { signIn, signUp } = useAccount();
  const [mode, setMode] = useState<'new' | 'back'>('new');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useBusy();
  const ok = /\S+@\S+\.\S+/.test(email) && password.length >= 6;
  return (
    <Step kicker="usync" title={mode === 'new' ? 'Share the load, not the nagging.' : 'Welcome back.'} body="usync works with two. Start now, invite your person after.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'new' ? 'new-password' : 'current-password'} placeholder="6 characters or more" />
      <Err text={error} />
      <PopButton label={busy ? 'One sec…' : mode === 'new' ? 'Create account' : 'Sign in'} tone="cream" disabled={!ok || busy} onPress={() => run(() => (mode === 'new' ? signUp(email, password) : signIn(email, password)))} />
      <PopButton label={mode === 'new' ? 'I already have an account' : 'I’m new here'} tone="ghost" onPress={() => setMode(mode === 'new' ? 'back' : 'new')} />
    </Step>
  );
}

export function NameStep() {
  const { saveName, signOut } = useAccount();
  const [name, setName] = useState('');
  const { busy, error, run } = useBusy();
  return (
    <Step kicker="1 of 2" title="What should your partner see?" body="Your first name is enough. It shows on cards and thanks.">
      <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="given-name" placeholder="Rahul" maxLength={24} />
      <Err text={error} />
      <PopButton label={busy ? 'Saving…' : 'Continue'} tone="cream" disabled={!name.trim() || busy} onPress={() => run(() => saveName(name))} />
      <PopButton label="Use a different account" tone="ghost" onPress={signOut} />
    </Step>
  );
}

export function PairStep() {
  const { createSpace, joinSpace, me } = useAccount();
  const [code, setCode] = useState('');
  const { busy, error, run } = useBusy();
  return (
    <Step kicker="2 of 2" title={`Hi ${me?.name ?? ''}. Who are you sharing with?`} body="One of you starts the space and shares a code. The other joins with it.">
      <PopButton label="Start our space" tone="ember" disabled={busy} onPress={() => run(createSpace)} />
      <Text variant="caption" color={theme.color.text.muted}>You get a code to send on WhatsApp. You can drop things before they join.</Text>
      <View style={styles.or}><Text variant="label/md" color={theme.color.text.muted}>or join theirs</Text></View>
      <Field label="Invite code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="K7Q2MX" maxLength={6} />
      <Err text={error} />
      <PopButton label={busy ? 'Joining…' : 'Join with code'} tone="lagoon" disabled={code.trim().length !== 6 || busy} onPress={() => run(() => joinSpace(code))} />
    </Step>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.color.bg.canvas },
  body: { paddingHorizontal: 20, gap: 12 },
  form: { gap: 14, marginTop: 20 },
  or: { alignItems: 'center', paddingVertical: 8 },
});
