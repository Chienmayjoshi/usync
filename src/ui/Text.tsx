import { Text as RNText, type TextProps } from 'react-native';

import { theme } from '@/theme/tokens';
import { type as typeStyles, type TypeVariant } from '@/theme/type';

type Props = TextProps & { variant?: TypeVariant; color?: string };

export function Text({ variant = 'body/md', color = theme.color.text.primary, style, ...rest }: Props) {
  return <RNText {...rest} style={[typeStyles[variant], { color }, style]} />;
}
