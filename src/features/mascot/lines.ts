import type { Card } from '@/features/deck/model';

import { DECK_LINES, NUDGE_LINES } from './linesData';

export { DECK_LINES, NUDGE_LINES };

export type NudgeLevel = 0 | 1 | 2 | 3;
export type NudgeKind = 'mine' | 'table';
export type Voice = 'he' | 'she' | 'neutral';
export type Mood = 'calm' | 'gentle' | 'cheeky' | 'firm' | 'proud' | 'asking';

export const MOOD_FOR: Record<NudgeLevel, Mood> = { 0: 'calm', 1: 'gentle', 2: 'cheeky', 3: 'firm' };

const DAY = 86_400_000;

/** How firm a nudge is for a card that has sat since `since` (as nudge_level in 0007). */
export function nudgeLevelSince(since: string | undefined, now: number, cap: number): NudgeLevel {
  if (!since) return 0;
  const days = (now - Date.parse(since)) / DAY;
  const level = days >= 10 ? 3 : days >= 6 ? 2 : days >= 3 ? 1 : 0;
  return Math.min(level, Math.max(1, Math.min(3, cap))) as NudgeLevel;
}

/** Which cards get nudged, and as which kind: mine and together while active, Table cards nobody took; never surprises. */
export function nudgeKind(card: Card): NudgeKind | null {
  // Never about a surprise: the partner's mascot would be nagging me about their own surprise.
  if (card.surprise) return null;
  if (card.status === 'active' && (card.owner === 'me' || card.owner === 'together')) return 'mine';
  if (card.status === 'deal' && card.owner === 'table' && !card.request && !card.surprise) return 'table';
  return null;
}

export function nudgeLevel(card: Card, now: number, cap: number): NudgeLevel {
  return nudgeKind(card) ? nudgeLevelSince(card.sortAt, now, cap) : 0;
}

/** The local day number, as `local_day - date '1970-01-01'` in Postgres. */
export const localDay = (now: number) => {
  const d = new Date(now);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
};

/** As nudge_seed in 0007: the task id's character codes plus the local day. */
export function nudgeSeed(taskId: string, day: number) {
  let sum = 0;
  for (const ch of taskId) sum += ch.charCodeAt(0);
  return sum + day;
}

/** Picks {he|she|neutral} and tidies the spaces, as nudge_line in 0007. */
export function inVoice(line: string, voice: Voice) {
  const pick = voice === 'he' ? 1 : voice === 'she' ? 2 : 3;
  return line.replace(/\{([^|}]*)\|([^|}]*)\|([^}]*)\}/g, (...m) => m[pick] as string).replace(/\s+/g, ' ');
}

/**
 * The task as "this", for lines shown right beside its title (the card, the row): Hindi takes
 * isko / is pe / isne where the title is followed by a postposition, yeh otherwise.
 */
export function asThis(line: string) {
  const out = line
    .replace(/%s ko\b/, 'isko')
    .replace(/%s pe\b/, 'is pe')
    .replace(/%s ne\b/, 'isne')
    .replace(/%s/, 'yeh');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * The mascot's line for a card today: the same one its push carried. `beside` is for a line shown
 * next to the card's title, so it says "yeh" rather than repeating the title.
 */
export function lineFor(card: Card, kind: NudgeKind, level: Exclude<NudgeLevel, 0>, voice: Voice, now: number, beside = false) {
  const lines = NUDGE_LINES[kind][level];
  const line = inVoice(lines[Math.abs(nudgeSeed(card.id, localDay(now))) % lines.length], voice);
  return beside ? asThis(line) : line.replace('%s', card.title);
}

export type DeckMood = { mood: Mood; line: string; card?: Card };

const today = (iso: string | null | undefined, now: number) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

/** How many cards I finished today (the rare good mood needs at least one). */
export const doneToday = (cards: Card[], now: number) =>
  cards.filter((c) => c.status === 'done' && c.doneBy === 'me' && today(c.doneAt, now)).length;

/**
 * One mood for the whole deck, Uncle Rudy style: the most ignored card sets it and the line names
 * that card. With nothing waiting: proud on a day I finished something, otherwise calm. Stable for a day.
 */
export function deckMood(deck: Card[], now: number, cap: number, voice: Voice, finished: number): DeckMood {
  let worst: { card: Card; kind: NudgeKind; level: Exclude<NudgeLevel, 0> } | null = null;
  for (const c of deck) {
    const kind = nudgeKind(c);
    const level = kind ? nudgeLevel(c, now, cap) : 0;
    if (!kind || !level) continue;
    const older = worst && level === worst.level && (c.sortAt ?? '') < (worst.card.sortAt ?? '');
    if (!worst || level > worst.level || older) worst = { card: c, kind, level };
  }
  if (worst) return { mood: MOOD_FOR[worst.level], line: lineFor(worst.card, worst.kind, worst.level, voice, now), card: worst.card };
  const mood = finished > 0 ? 'proud' : 'calm';
  const lines = DECK_LINES[mood];
  const line = inVoice(lines[localDay(now) % lines.length], voice).replace('%d', String(finished));
  return { mood, line };
}

/** What the partner's mascot says while asking something of me. */
export function askLine(request: 'take' | 'together' | 'give', cardId: string, voice: Voice, now: number) {
  const lines = DECK_LINES.ask[request];
  return inVoice(lines[nudgeSeed(cardId, localDay(now)) % lines.length], voice);
}
