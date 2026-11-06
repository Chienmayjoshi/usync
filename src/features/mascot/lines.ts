import type { Card } from '@/features/deck/model';

import { NUDGE_LINES } from './linesData';

export { NUDGE_LINES };

export type NudgeLevel = 0 | 1 | 2 | 3;
export type NudgeKind = 'mine' | 'table';
export type Voice = 'he' | 'she' | 'neutral';
export type Mood = 'calm' | 'gentle' | 'cheeky' | 'firm';

export const MOOD_FOR: Record<NudgeLevel, Mood> = { 0: 'calm', 1: 'gentle', 2: 'cheeky', 3: 'firm' };

const DAY = 86_400_000;

/** How firm a nudge is for a card that has sat since `since` (as nudge_level in 0007). */
export function nudgeLevelSince(since: string | undefined, now: number, cap: number): NudgeLevel {
  if (!since) return 0;
  const days = (now - Date.parse(since)) / DAY;
  const level = days >= 10 ? 3 : days >= 6 ? 2 : days >= 3 ? 1 : 0;
  return Math.min(level, Math.max(1, Math.min(3, cap))) as NudgeLevel;
}

/** Which cards get nudged, and as which kind: mine and together while active, Table cards nobody took. */
export function nudgeKind(card: Card): NudgeKind | null {
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
