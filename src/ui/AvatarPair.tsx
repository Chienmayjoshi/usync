import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme/tokens';

import { Text } from './Text';

type Props = { a?: string; b?: string; /** Lets a feature wrap the partner avatar, e.g. to make it a drop target. */ wrapPartner?: (node: ReactNode) => ReactNode };

export function AvatarPair({ a = 'R', b = 'M', wrapPartner = (n) => n }: Props) {
  return (
    <View style={styles.row} accessibilityLabel="Rahul and Meera">
      <View style={[styles.av, { backgroundColor: theme.color.partner.a }]}><Text variant="title/md" color={theme.color.text.inverse}>{a}</Text></View>
      <View style={styles.second}>
        {wrapPartner(<View style={[styles.av, { backgroundColor: theme.color.partner.b }]}><Text variant="title/md" color={theme.color.text.inverse}>{b}</Text></View>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.color.bg.canvas },
  second: { marginLeft: -10 },
});
