// What you can send for a finished card (0010): a tap sends a heart, a hold picks one of five.
// Keep the keys and lines in step with reaction_line in supabase/migrations/0010_reactions.sql.

export type Reaction = 'heart' | 'care' | 'laugh' | 'wow' | 'tears';

export const REACTIONS: { key: Reaction; emoji: string; label: string; sent: string; verb: string }[] = [
  { key: 'heart', emoji: '❤️', label: 'Heart', sent: 'You sent a heart', verb: 'sent you a heart' },
  { key: 'care', emoji: '🤗', label: 'Care', sent: 'You sent a hug', verb: 'sent you a hug' },
  { key: 'laugh', emoji: '😂', label: 'Haha', sent: 'You laughed', verb: 'laughed at this' },
  { key: 'wow', emoji: '😮', label: 'Wow', sent: 'You were impressed', verb: 'is impressed' },
  { key: 'tears', emoji: '🥹', label: 'Moved', sent: 'You were moved', verb: 'is moved' },
];

export const reactionOf = (key: string | null | undefined) => REACTIONS.find((r) => r.key === key) ?? REACTIONS[0];

/** What the partner reads: "Chinmay sent you a hug 🤗". */
export const reactionLine = (key: string | null | undefined, who: string) => {
  const r = reactionOf(key);
  return `${who} ${r.verb} ${r.emoji}`;
};

/** Which slot of the picker sits under x (relative to the pill's left edge), or null outside it. */
export function slotAt(x: number, width: number, count = REACTIONS.length): number | null {
  'worklet';
  if (width <= 0 || x < 0 || x > width) return null;
  return Math.min(count - 1, Math.floor((x / width) * count));
}
