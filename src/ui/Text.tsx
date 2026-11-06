import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { type as typeStyles, type TypeVariant } from '@/theme/type';

type Props = TextProps & { variant?: TypeVariant; color?: string };

/**
 * Text sizes are the design's, on every phone: the system text size setting does not scale them
 * (a caller can opt back in with allowFontScaling / maxFontSizeMultiplier).
 */
export function Text({ variant = 'body/md', color, style, maxFontSizeMultiplier = 1, ...rest }: Props) {
  const t = useTheme();
  const fallback = variant.startsWith('display/') && variant !== 'display/accent' ? t.color.text.title : t.color.text.primary;
  return <RNText maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} style={[typeStyles[variant], { color: color ?? fallback }, style]} />;
}
