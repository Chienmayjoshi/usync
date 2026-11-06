import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

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

/**
 * One of Figma's blurred ellipses: its box (x, y, size) in the parent's pixels, and its blur.
 * With `sigma` (the SVG export's feGaussianBlur stdDeviation) the light is drawn as that exact
 * blurred disc; without it, the older soft approximation spreading `blur` past the edge.
 */
export type Blob = { x: number; y: number; size: number; blur: number; color: string; sigma?: number };

/** e^-x * I0(x), the scaled modified Bessel function: stays finite for large x. */
function i0e(x: number) {
  if (x < 15) {
    let sum = 1;
    let term = 1;
    for (let k = 1; k < 40; k++) { term *= (x / 2) ** 2 / (k * k); sum += term; }
    return sum * Math.exp(-x);
  }
  return (1 + 1 / (8 * x) + 9 / (128 * x * x)) / Math.sqrt(2 * Math.PI * x);
}

/** Intensity at distance d from the centre of a solid disc of radius r after a Gaussian blur of sigma s. */
function blurredDisc(r: number, s: number, d: number) {
  const steps = 48;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const rho = ((i + 0.5) / steps) * r;
    sum += (rho / (s * s)) * Math.exp(-((d - rho) ** 2) / (2 * s * s)) * i0e((d * rho) / (s * s)) * (r / steps);
  }
  return Math.min(1, sum);
}

/** Gradient stops (offset 0..1 of radius r + 3 sigma) tracing the blurred disc's falloff. */
function discStops(r: number, s: number) {
  const R = r + 3 * s;
  return Array.from({ length: 13 }, (_, i) => {
    const f = i / 12;
    return { offset: f, alpha: blurredDisc(r, s, f * R) };
  });
}

/**
 * Figma's "ellipse + layer blur" drawn as a radial gradient. A Gaussian blur of radius b spreads
 * a disc of radius r to roughly r + b, solid in the middle and fading out, so the gradient runs
 * that far and eases off the same way.
 */
export function Blobs({ blobs, opacity }: { blobs: Blob[]; opacity?: number }) {
  const t = useTheme();
  const id = useId().replace(/:/g, '');
  const o = opacity ?? (t.scheme === 'light' ? 1 : t.color.glowOpacity * 1.6);
  // Drawn at the box's measured size, each light as a radial gradient painted over the whole box
  // (userSpaceOnUse). Native clips huge shapes and percentage sized canvases unpredictably, so no
  // ellipse ever reaches past the box.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height }); }}
    >
      {box && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            {blobs.map((b, i) => (
              <RadialGradient
                key={i}
                id={`g${id}${i}`}
                gradientUnits="userSpaceOnUse"
                cx={b.x + b.size / 2}
                cy={b.y + b.size / 2}
                fx={b.x + b.size / 2}
                fy={b.y + b.size / 2}
                r={b.size / 2 + (b.sigma != null ? 3 * b.sigma : b.blur)}
              >
                {(b.sigma != null
                  ? discStops(b.size / 2, b.sigma)
                  : [{ offset: 0, alpha: 1 }, { offset: (b.size / 2 / (b.size / 2 + b.blur)) * 0.7, alpha: 0.85 }, { offset: 1, alpha: 0 }]
                ).map((st) => <Stop key={st.offset} offset={String(st.offset)} stopColor={b.color} stopOpacity={o * st.alpha} />)}
              </RadialGradient>
            ))}
          </Defs>
          {blobs.map((_, i) => <Rect key={i} x={0} y={0} width={box.w} height={box.h} fill={`url(#g${id}${i})`} />)}
        </Svg>
      )}
    </View>
  );
}
