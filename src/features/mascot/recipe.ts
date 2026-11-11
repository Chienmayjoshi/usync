import { schema } from '@dicebear/open-peeps';

import type { Mood } from './lines';

/**
 * A mascot: Open Peeps parts (Pablo Stanley, CC0, through DiceBear) picked in the builder.
 * Stored on members.mascot. The face is never stored: it follows the nudge's mood.
 */
export type MascotRecipe = {
  v: 1;
  head: string;
  facialHair: string | null;
  accessories: string | null;
  skin: string;
  clothing: string;
};

const opts = (key: string): string[] => {
  const p = (schema.properties as Record<string, { items?: { enum?: string[] }; default?: string[] }>)[key];
  return p?.items?.enum ?? p?.default ?? [];
};

/** Every choice the builder offers, straight from the style's schema. */
export const PARTS = {
  head: opts('head'),
  facialHair: opts('facialHair'),
  accessories: opts('accessories').filter((a) => a !== 'eyepatch'),
  skin: opts('skinColor'),
  clothing: opts('clothingColor'),
};

/** The face each mood wears: calm at rest, then gentle, cheeky and firm as a card waits. */
export const MOOD_FACE: Record<Mood, string> = {
  calm: 'calm',
  gentle: 'smile',
  cheeky: 'cheeky',
  firm: 'driven',
  // Rare: a day that went well. And the face it wears while asking something of you.
  proud: 'lovingGrin1',
  asking: 'explaining',
};

/** Who nudges until a person makes their own: a friendly usync peep. */
export const DEFAULT_RECIPE: MascotRecipe = { v: 1, head: 'short2', facialHair: null, accessories: null, skin: 'edb98a', clothing: '9ddadb' };

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

export function randomRecipe(): MascotRecipe {
  return {
    v: 1,
    head: pick(PARTS.head),
    facialHair: Math.random() < 0.25 ? pick(PARTS.facialHair) : null,
    accessories: Math.random() < 0.3 ? pick(PARTS.accessories) : null,
    skin: pick(PARTS.skin),
    clothing: pick(PARTS.clothing),
  };
}

/** A stored recipe, made safe: unknown parts (from a newer or older app) fall back to the default's. */
export function validRecipe(r: unknown): MascotRecipe | null {
  if (!r || typeof r !== 'object') return null;
  const x = r as Partial<MascotRecipe>;
  return {
    v: 1,
    head: x.head && PARTS.head.includes(x.head) ? x.head : DEFAULT_RECIPE.head,
    facialHair: x.facialHair && PARTS.facialHair.includes(x.facialHair) ? x.facialHair : null,
    accessories: x.accessories && PARTS.accessories.includes(x.accessories) ? x.accessories : null,
    skin: x.skin && PARTS.skin.includes(x.skin) ? x.skin : DEFAULT_RECIPE.skin,
    clothing: x.clothing && PARTS.clothing.includes(x.clothing) ? x.clothing : DEFAULT_RECIPE.clothing,
  };
}

/** DiceBear options for a recipe wearing a mood: every part pinned, nothing left to chance. */
export function toOptions(r: MascotRecipe, mood: Mood) {
  return {
    seed: 'usync',
    head: [r.head],
    face: [MOOD_FACE[mood]],
    facialHair: r.facialHair ? [r.facialHair] : [],
    facialHairProbability: r.facialHair ? 100 : 0,
    accessories: r.accessories ? [r.accessories] : [],
    accessoriesProbability: r.accessories ? 100 : 0,
    maskProbability: 0,
    skinColor: [r.skin],
    clothingColor: [r.clothing],
  };
}
