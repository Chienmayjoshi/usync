import type { Card } from './model';

export type DotColors = readonly [string, string];

/**
 * Each task's round token gets its own pair of lights, so the My Deck pill tells tasks apart
 * (Figma 232:22580). The first three are Figma's; the rest are picked to sit well beside them.
 */
export const DOT_PALETTE: readonly DotColors[] = [
  ['#F669A6', '#FEF26B'], // pink / yellow (Figma)
  ['#8D65F0', '#6BFE81'], // violet / green (Figma)
  ['#66DBF5', '#FF8CF2'], // cyan / pink (Figma)
  ['#FF7A3D', '#FEF26B'], // orange / yellow
  ['#2FC7A8', '#D3FF41'], // teal / lime
  ['#3E7BFA', '#FFB199'], // blue / peach
  ['#FF4F5E', '#C9B8FF'], // red / lavender
  ['#F5B731', '#5ED6C4'], // gold / teal
];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Colors for a set of tasks, every one different while the palette lasts. Each task starts from
 * its own (id based) pick and moves on to the next free one if taken, in a stable order, so a
 * task keeps its color as others come and go.
 */
export function assignDots(cards: Card[]): Map<string, DotColors> {
  const out = new Map<string, DotColors>();
  const used = new Set<number>();
  for (const c of [...cards].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    let i = hash(c.id) % DOT_PALETTE.length;
    if (used.size < DOT_PALETTE.length) while (used.has(i)) i = (i + 1) % DOT_PALETTE.length;
    used.add(i);
    out.set(c.id, DOT_PALETTE[i]);
  }
  return out;
}
