import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { theme } from '@/theme/tokens';

import { Text } from './Text';

/** Labelled single line input in the app's style. */
export function Field({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={styles.wrap}>
      <Text variant="label/md" color={theme.color.text.muted}>{label}</Text>
      <TextInput placeholderTextColor={theme.color.text.muted} style={styles.input} {...input} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    backgroundColor: theme.color.bg.surface, borderWidth: 1.5, borderColor: theme.color.border.strong,
    color: theme.color.text.primary, fontFamily: 'Manrope_700Bold', fontSize: 17, paddingHorizontal: 14, paddingVertical: 12,
  },
});
