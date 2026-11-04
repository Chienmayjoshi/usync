import { router } from 'expo-router';
import { GearSix } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AvatarPair } from '@/ui/AvatarPair';

import { useNames } from './account';

/** The avatar pair and the settings gear, at the right of every tab header. */
export function HeaderAvatars({ wrapPartner }: { wrapPartner?: (node: ReactNode) => ReactNode }) {
  const n = useNames();
  const t = useTheme();
  return (
    <View style={styles.row}>
      <AvatarPair
        me={{ initial: n.initials.a, avatar: n.avatars.a, color: n.colors.me }}
        partner={n.partner ? { initial: n.initials.b, avatar: n.avatars.b, color: n.colors.partner } : null}
        wrapPartner={wrapPartner}
        onPress={() => router.push('/settings')}
      />
      <Pressable onPress={() => router.push('/settings')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Settings" style={styles.icon}>
        <GearSix size={24} color={t.color.text.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
