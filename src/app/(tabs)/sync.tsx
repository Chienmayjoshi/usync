import { StyleSheet, View } from 'react-native';

import { useAccount, useNames } from '@/features/account/account';
import { balanceTilt } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { theme } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Screen } from '@/ui/Screen';
import { Seesaw } from '@/ui/Seesaw';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

export default function SyncScreen() {
  const { state } = useDeck();
  const toast = useToast();
  const { me, partner, inviteCode, signOut, leaveSpace } = useAccount();
  const names = useNames();
  const stories = state.album.slice(0, 3);
  const quiet = stories.length === 0;

  return (
    <Screen kicker="Sunday sync  ·  1 of 3" title="Your week" initials={names.initials}>
      <View style={styles.steps}>
        {[1, 2, 3].map((i) => <View key={i} style={[styles.step, i === 1 && styles.stepOn]} />)}
      </View>
      <Text variant="display/2xl">{quiet ? 'A quiet week.' : 'Your week.'}</Text>
      <View style={styles.center}><Seesaw tilt={balanceTilt(state)} scale={0.9} /></View>
      {quiet ? (
        <Text variant="body/lg" color={theme.color.text.secondary}>Nothing needed doing. That counts as a good week too.</Text>
      ) : (
        stories.map((s) => (
          <View key={s.id} style={styles.story}>
            <Text variant="label/md" color={s.together ? theme.color.together.base : theme.color.partner.a}>{s.together ? 'Both' : 'Done'}</Text>
            <Text variant="title/md">{s.title}</Text>
          </View>
        ))
      )}
      <Text variant="caption" color={theme.color.text.muted}>{`${state.weeksInSync} weeks in sync. Missing a week pauses it, never resets it.`}</Text>
      <PopButton label="Next" tone="cream" onPress={() => toast({ kind: 'info', title: 'Coming in M4', body: 'Appreciate, next hand and the sealed reveal.', ms: 3000 })} />

      <View style={styles.account}>
        <Text variant="label/md" color={theme.color.text.muted}>Account</Text>
        <Text variant="body/md">{`${me?.name ?? ''}${partner ? ` with ${partner.name}` : ' · waiting for your partner'}`}</Text>
        {inviteCode && <Text variant="body/md" color={theme.color.text.secondary}>{`Space code: ${inviteCode}`}</Text>}
        <PopButton label="Sign out" tone="ghost" onPress={signOut} />
        <PopButton label="Leave this space" tone="ghost" onPress={() => leaveSpace().catch(() => undefined)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 4, backgroundColor: theme.color.border.subtle },
  stepOn: { backgroundColor: theme.color.together.base },
  center: { alignItems: 'center' },
  account: { marginTop: 24, gap: 8, borderTopWidth: 1, borderTopColor: theme.color.border.subtle, paddingTop: 16 },
  story: { borderTopWidth: 1, borderTopColor: theme.color.border.subtle, paddingTop: 12, gap: 4 },
});
