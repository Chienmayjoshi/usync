import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { type as typeStyles, type TypeVariant } from '@/theme/type';

type Props = TextProps & { variant?: TypeVariant; color?: string };

export function Text({ variant = 'body/md', color, style, ...rest }: Props) {
  const t = useTheme();
  const fallback = variant.startsWith('display/') && variant !== 'display/accent' ? t.color.text.title : t.color.text.primary;
  return <RNText {...rest} style={[typeStyles[variant], { color: color ?? fallback }, style]} />;
}
