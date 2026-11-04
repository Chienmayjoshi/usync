import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  colors: readonly [string, string];
  /** Where the lights sit: top of a card (default) or centered behind a chip. */
  placement?: 'top' | 'center';
  opacity?: number;
};

/**
 * The Figma cards glow from two heavily blurred ellipses. A blur filter is costly on Android,
 * so the same light is drawn as two radial gradients that fade to nothing.
 */
export function Glow({ colors, placement = 'top', opacity }: Props) {
  const t = useTheme();
  const id = useId().replace(/:/g, '');
  const o = opacity ?? t.color.glowOpacity;
  const top = placement === 'top';
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`a${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors[0]} stopOpacity={o} />
          <Stop offset="1" stopColor={colors[0]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`b${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors[1]} stopOpacity={o} />
          <Stop offset="1" stopColor={colors[1]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={top ? 22 : 30} cy={top ? 10 : 50} rx={top ? 60 : 50} ry={top ? 42 : 90} fill={`url(#a${id})`} />
      <Ellipse cx={top ? 82 : 72} cy={top ? 16 : 50} rx={top ? 56 : 50} ry={top ? 40 : 90} fill={`url(#b${id})`} />
    </Svg>
  );
}
