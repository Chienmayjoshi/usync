// What you can send for a finished card. Tap Appreciate, pick one of four (Figma 299:25101).
// Keep the keys and lines in step with reaction_line in supabase/migrations/0011_reactions_four.sql.

export type Reaction = 'thumbs' | 'heart' | 'smile' | 'party' | 'care' | 'laugh' | 'wow' | 'tears';

type Entry = { key: Reaction; emoji: string; label: string; verb: string };

/** The four on offer, in the order the row shows them. */
export const REACTIONS: Entry[] = [
  { key: 'thumbs', emoji: '👍', label: 'Thumbs up', verb: 'gave you a thumbs up' },
  { key: 'heart', emoji: '❤️', label: 'Heart', verb: 'sent you a heart' },
  { key: 'smile', emoji: '😊', label: 'Smile', verb: 'smiled at this' },
  { key: 'party', emoji: '🎉', label: 'Celebrate', verb: 'is celebrating this' },
];

/** Sent before the four (0010): still shown right when they come back from the server. */
const OLDER: Entry[] = [
  { key: 'care', emoji: '🤗', label: 'Hug', verb: 'sent you a hug' },
  { key: 'laugh', emoji: '😂', label: 'Haha', verb: 'laughed at this' },
  { key: 'wow', emoji: '😮', label: 'Wow', verb: 'is impressed' },
  { key: 'tears', emoji: '🥹', label: 'Moved', verb: 'is moved' },
];

const HEART = REACTIONS[1];
export const reactionOf = (key: string | null | undefined) =>
  REACTIONS.find((r) => r.key === key) ?? OLDER.find((r) => r.key === key) ?? HEART;

/** What the partner reads: "Chinmay gave you a thumbs up 👍". */
export const reactionLine = (key: string | null | undefined, who: string) => {
  const r = reactionOf(key);
  return `${who} ${r.verb} ${r.emoji}`;
};
