import { TextInput, type TextInputProps, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/type';

import { Text } from './Text';

/** Labelled input on a soft grey well, as in the redesign's sheets. */
export function Field({ label, style, ...input }: TextInputProps & { label: string }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.wrap}>
      <Text variant="label/md" color={t.color.text.secondary}>{label}</Text>
      <TextInput
        placeholderTextColor={t.color.text.placeholder}
        keyboardAppearance={t.scheme}
        selectionColor={t.color.text.primary}
        style={[s.input, style]}
        {...input}
      />
    </View>
  );
}

export const useInputStyles = makeStyles((t) => ({
  well: { backgroundColor: t.color.bg.surface, borderRadius: t.radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  text: { color: t.color.text.primary, fontFamily: fonts.uiSemiBold, fontSize: 17, lineHeight: 22 },
}));

const useStyles = makeStyles((t) => ({
  wrap: { gap: 8 },
  input: {
    backgroundColor: t.color.bg.surface, borderRadius: t.radius.md,
    color: t.color.text.primary, fontFamily: fonts.uiSemiBold, fontSize: 17, paddingHorizontal: 14, paddingVertical: 12,
  },
}));
