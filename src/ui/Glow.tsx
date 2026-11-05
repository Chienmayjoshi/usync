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
 * Soft light behind a surface, scaled to whatever it sits in (used where Figma has no exact spot).
 * For Figma's exact blurred ellipses use <Blobs>.
 */
export function Glow({ colors, placement = 'top', opacity }: Props) {
  const t = useTheme();
  const id = useId().replace(/:/g, '');
  const o = opacity ?? t.color.glowOpacity;
  const top = placement === 'top';
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 100 100">
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

/** One of Figma's blurred ellipses: its box (x, y, size) in the parent's pixels, and its blur. */
export type Blob = { x: number; y: number; size: number; blur: number; color: string };

/**
 * Figma's "ellipse + layer blur" drawn as a radial gradient. A Gaussian blur of radius b spreads
 * a disc of radius r to roughly r + b, solid in the middle and fading out, so the gradient runs
 * that far and eases off the same way.
 */
export function Blobs({ blobs, opacity }: { blobs: Blob[]; opacity?: number }) {
  const t = useTheme();
  const id = useId().replace(/:/g, '');
  const o = opacity ?? (t.scheme === 'light' ? 1 : t.color.glowOpacity * 1.6);
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {blobs.map((b, i) => (
          <RadialGradient key={i} id={`g${id}${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={b.color} stopOpacity={o} />
            <Stop offset={String(b.size / 2 / (b.size / 2 + b.blur) * 0.7)} stopColor={b.color} stopOpacity={o * 0.85} />
            <Stop offset="1" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map((b, i) => {
        const r = b.size / 2 + b.blur;
        return <Ellipse key={i} cx={b.x + b.size / 2} cy={b.y + b.size / 2} rx={r} ry={r} fill={`url(#g${id}${i})`} />;
      })}
    </Svg>
  );
}
