import { router } from 'expo-router';
import { Bell, GearSix } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useActivity } from '@/features/notify/activity';
import { useTheme } from '@/theme/ThemeProvider';
import { AvatarPair } from '@/ui/AvatarPair';

import { useNames } from './account';

/** Right side of every tab header: the two of you, the activity bell and settings. */
export function HeaderAvatars({ wrapPartner }: { wrapPartner?: (node: ReactNode) => ReactNode }) {
  const n = useNames();
  const t = useTheme();
  const { unread } = useActivity();
  return (
    <View style={styles.row}>
      <AvatarPair
        me={{ initial: n.initials.a, avatar: n.avatars.a, color: n.colors.me }}
        partner={n.partner ? { initial: n.initials.b, avatar: n.avatars.b, color: n.colors.partner } : null}
        wrapPartner={wrapPartner}
        onPress={() => router.push('/settings')}
      />
      <Pressable onPress={() => router.push('/activity')} hitSlop={4} accessibilityRole="button" accessibilityLabel={unread ? 'Activity, new' : 'Activity'} style={styles.icon}>
        <Bell size={24} color={t.color.text.primary} />
        {unread && <View style={[styles.dot, { backgroundColor: t.color.accent.heart, borderColor: t.color.bg.canvas }]} />}
      </Pressable>
      <Pressable onPress={() => router.push('/settings')} hitSlop={4} accessibilityRole="button" accessibilityLabel="Settings" style={styles.icon}>
        <GearSix size={24} color={t.color.text.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
