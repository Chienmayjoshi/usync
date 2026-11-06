import { createAvatar } from '@dicebear/core';
import * as openPeeps from '@dicebear/open-peeps';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { Mood } from './lines';
import { DEFAULT_RECIPE, type MascotRecipe, toOptions, validRecipe } from './recipe';

const cache = new Map<string, string>();

/** The SVG for a recipe in a mood, made once and kept: lists of rows reuse it. */
export function mascotSvg(recipe: MascotRecipe | null | undefined, mood: Mood) {
  const r = validRecipe(recipe) ?? DEFAULT_RECIPE;
  const key = JSON.stringify([r, mood]);
  let svg = cache.get(key);
  if (!svg) {
    // Recipes are checked against the schema (validRecipe), so the part ids are the style's own.
    svg = createAvatar(openPeeps, toOptions(r, mood) as Parameters<typeof createAvatar<openPeeps.Options>>[1]).toString();
    cache.set(key, svg);
  }
  return svg;
}

type Props = {
  recipe: MascotRecipe | null | undefined;
  mood: Mood;
  size: number;
  /** The circle behind the peep (the person's color); none for a cut out. */
  bg?: string;
};

/** A person's mascot: their Open Peep, head and shoulders, in a round frame, wearing a mood. */
export function Mascot({ recipe, mood, size, bg }: Props) {
  const xml = useMemo(() => mascotSvg(recipe, mood), [recipe, mood]);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: bg }}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
