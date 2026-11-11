import type { Tone } from '@/theme/tokens';

import type { Card } from './model';

/** The colours a task can have; the same seven as tasks.color (0012). */
export const TASK_TONES = ['rose', 'lagoon', 'ember', 'violet', 'lime', 'sky', 'gold'] as const satisfies readonly Tone[];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * A task's own colour, the same on the Table, in My Deck and on the Partner tab. The server picks
 * it when the task is made; until a row carries one, its id picks one of the same seven.
 */
export function toneFor(card: Pick<Card, 'id' | 'color'>): Tone {
  const c = card.color as Tone | null | undefined;
  if (c && (TASK_TONES as readonly string[]).includes(c)) return c;
  return TASK_TONES[hash(card.id) % TASK_TONES.length];
}
