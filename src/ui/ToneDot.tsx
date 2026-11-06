import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { Tone } from '@/theme/tokens';

import { type Blob, Blobs } from './Glow';

// The two lights inside the round token, from the SVG exports: the 32 dot in the My Deck pill
// (Figma 223:22021) and the 80 circle a card becomes on its way there (223:21908).
const SMALL: Omit<Blob, 'color'>[] = [
  { x: 0.5 - 27, y: 11 - 27, size: 54, blur: 0, sigma: 4.5 },
  { x: 27 - 13.5, y: 28.5 - 13.5, size: 27, blur: 0, sigma: 9.5 },
];
const LARGE: Omit<Blob, 'color'>[] = [
  { x: 17.5 - 68.5, y: 6.5 - 68.5, size: 137, blur: 0, sigma: 17 },
  { x: 101 - 71, y: 99 - 71, size: 142, blur: 0, sigma: 17 },
];

/** A card as a round token: white, two of its tone's lights, a 1.5 white stroke. */
export function ToneDot({ tone, size = 32 }: { tone: Tone; size?: number }) {
  const t = useTheme();
  const colors = t.tones[tone].dot;
  const base = size >= 56 ? 80 : 32;
  const k = size / base;
  const blobs = (base === 80 ? LARGE : SMALL).map((b, i) => ({
    ...b, x: b.x * k, y: b.y * k, size: b.size * k, sigma: (b.sigma ?? 0) * k, color: colors[i],
  }));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
      <Blobs opacity={1} blobs={blobs} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: size / 2, borderWidth: 1.5, borderColor: '#FFFFFF' }} />
    </View>
  );
}
