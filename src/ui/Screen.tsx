import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme/tokens';

import { AvatarPair } from './AvatarPair';
import { Text } from './Text';

type Props = { kicker: string; title: string; children: ReactNode; scroll?: boolean; initials?: { a: string; b: string | null }; wrapPartner?: (node: ReactNode) => ReactNode };

export function Screen({ kicker, title, children, scroll = true, initials, wrapPartner }: Props) {
  const insets = useSafeAreaInsets();
  const header = (
    <View style={styles.header}>
      <View>
        <Text variant="label/md" color={theme.color.text.muted}>{kicker}</Text>
        <Text variant="title/lg">{title}</Text>
      </View>
      <AvatarPair a={initials?.a} b={initials?.b} wrapPartner={wrapPartner} />
    </View>
  );
  if (!scroll) {
    return <View style={[styles.body, { paddingTop: insets.top + 8 }]}>{header}{children}</View>;
  }
  return (
    <ScrollView style={styles.fill} contentContainerStyle={[styles.body, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>
      {header}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.color.bg.canvas },
  // Bottom room so the floating Drop button never covers the last controls.
  body: { paddingHorizontal: 16, paddingBottom: 140, gap: 20, flexGrow: 1, backgroundColor: theme.color.bg.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
