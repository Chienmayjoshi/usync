import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme/tokens';

import { Text } from './Text';

type Props = { kicker: string; title: string; children: ReactNode; scroll?: boolean; right?: ReactNode };

export function Screen({ kicker, title, children, scroll = true, right }: Props) {
  const insets = useSafeAreaInsets();
  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text variant="label/md" color={theme.color.text.muted}>{kicker}</Text>
        <Text variant="title/lg">{title}</Text>
      </View>
      {right}
    </View>
  );
  if (!scroll) {
    return <View style={[styles.body, { paddingTop: insets.top + 8 }]}>{header}{children}</View>;
  }
  return (
    // Inputs on scrolling screens (Sync's appreciation) stay above the keyboard on both platforms.
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.color.bg.canvas },
  flex: { flex: 1 },
  // Bottom room so the floating Drop button never covers the last controls.
  body: { paddingHorizontal: 16, paddingBottom: 120, gap: 20, flexGrow: 1, backgroundColor: theme.color.bg.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
});
