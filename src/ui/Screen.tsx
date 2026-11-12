import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

/** The header row's top, under the status bar (Figma: 72 on a 54 inset). Shared with the Table. */
export const HEADER_TOP = 18;

type Props = { title: string; kicker?: string; children: ReactNode; scroll?: boolean; right?: ReactNode };

/** A tab screen: big upper case title on the left, people and settings on the right. */
export function Screen({ kicker, title, children, scroll = true, right }: Props) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const s = useStyles();
  const header = (
    <View style={s.header}>
      <View style={s.flex}>
        <Text variant="display/lg" numberOfLines={1}>{title}</Text>
        {!!kicker && <Text variant="caption" color={t.color.text.secondary}>{kicker}</Text>}
      </View>
      {right}
    </View>
  );
  if (!scroll) {
    return <View style={[s.body, { paddingTop: insets.top + HEADER_TOP }]}>{header}{children}</View>;
  }
  return (
    // Inputs on scrolling screens stay above the keyboard on both platforms.
    <KeyboardAvoidingView behavior="padding" style={s.fill}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={[s.body, { paddingTop: insets.top + HEADER_TOP }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.color.bg.canvas },
  flex: { flex: 1 },
  // Bottom room so the floating tab pill never covers the last controls.
  body: { paddingHorizontal: 20, paddingBottom: 128, gap: 16, flexGrow: 1, backgroundColor: t.color.bg.canvas },
  // Figma 300:25132: a 68 row (10 above and below the 48 bell and avatar), the same as the Table's
  // header, so switching tabs never moves it.
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 10 },
}));
