import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme/tokens';

import { Text } from './Text';

export function AvatarPair({ a = 'R', b = 'M' }: { a?: string; b?: string }) {
  return (
    <View style={styles.row} accessibilityLabel="Rahul and Meera">
      <View style={[styles.av, { backgroundColor: theme.color.partner.a }]}><Text variant="title/md" color={theme.color.text.inverse}>{a}</Text></View>
      <View style={[styles.av, styles.second, { backgroundColor: theme.color.partner.b }]}><Text variant="title/md" color={theme.color.text.inverse}>{b}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.color.bg.canvas },
  second: { marginLeft: -10 },
});
