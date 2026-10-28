import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme, type PersonColor, tones } from '@/theme/tokens';

import { Text } from './Text';

type Person = { initial: string | null; avatar: string | null; color: PersonColor };

/** One person: their emoji if they picked one, else their initial, on their color. */
export function Avatar({ initial, avatar, color, size = 40 }: Person & { size?: number }) {
  return (
    <View style={[styles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: tones[color].face }]}>
      {avatar
        ? <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{avatar}</Text>
        : <Text variant="title/md" color={theme.color.text.inverse} style={size > 48 ? { fontSize: size * 0.42, lineHeight: size * 0.5 } : undefined}>{initial ?? '?'}</Text>}
    </View>
  );
}

type Props = {
  me: Person;
  partner: Person | null;
  /** Lets a feature wrap the partner avatar, e.g. to make it a drop target. */
  wrapPartner?: (node: ReactNode) => ReactNode;
  onPress?: () => void;
};

export function AvatarPair({ me, partner, wrapPartner = (n) => n, onPress }: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Profile and settings' : partner ? 'You and your partner' : 'You, partner not joined yet'}
    >
      <Avatar {...me} />
      <View style={styles.second}>
        {partner ? wrapPartner(<Avatar {...partner} />) : (
          <View style={[styles.av, styles.empty]}><Text variant="title/md" color={theme.color.text.secondary}>+</Text></View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.color.bg.canvas },
  second: { marginLeft: -10 },
  empty: { borderStyle: 'dashed', borderColor: theme.color.border.strong, backgroundColor: theme.color.bg.canvas },
});
