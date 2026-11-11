import { type Card, forMe } from '@/features/deck/model';
import type { Reaction } from '@/features/thanks/reactions';

// The Activity log's brains, kept pure: what each entry's card is doing now, where a tap on it
// (or on its push) should land, and how the list is grouped (Figma 286:7199).

export type ActivityData = { task_id?: string; task_ids?: string[]; request?: string; yes?: boolean; level?: number; surprise?: boolean; reaction?: string };
export type ActivityItem = { id: number; kind: string; title: string; body: string; created_at: string; data?: ActivityData | null };

/** Where to go: a tab, and the card to bring into focus there. */
export type Place = 'table' | 'ask' | 'deck' | 'partner';
export type Focus = { id?: string; place: Place; at: number };
export type Destination = { path: '/' | '/us' | '/sync'; focus?: Omit<Focus, 'at'> } | null;

export type Tone = 'pending' | 'ok' | 'muted' | 'partner' | 'alert';
export type Status = { label: string; tone: Tone; pending: boolean; action?: 'answer' | 'appreciate' };

export const taskIds = (i: ActivityItem): string[] =>
  i.data?.task_ids?.length ? i.data.task_ids : i.data?.task_id ? [i.data.task_id] : [];

const DAY = 86_400_000;

/** Where a card sits now, in a few words. */
export function placeOf(card: Card, partner: string): string {
  if (card.status === 'done') return 'Done';
  if (card.owner === 'table') return 'On the table';
  if (card.owner === 'together') return 'Doing together';
  if (card.owner === 'me') return 'On your deck';
  return `On ${partner}’s deck`;
}

type Ctx = { cards: Card[]; partner: string; reacted: Map<string, Reaction>; now: number };

/** The live line under an entry: what its card is doing now, not what it did then. */
export function liveStatus(item: ActivityItem, ctx: Ctx): Status | null {
  const ids = taskIds(item);
  const cards = ids.map((id) => ctx.cards.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const card = cards[0];
  switch (item.kind) {
    case 'sync':
      return { label: 'Open the sync', tone: 'ok', pending: false };
    case 'hand':
      return { label: 'On your deck', tone: 'ok', pending: false };
    case 'thanks':
      return { label: 'In your album', tone: 'ok', pending: false };
  }
  if (!card) return { label: 'No longer here', tone: 'muted', pending: false };

  switch (item.kind) {
    case 'request': {
      if (forMe(card) && card.request === (item.data?.request ?? card.request)) return { label: 'Waiting on you', tone: 'pending', pending: true, action: 'answer' };
      if (card.status !== 'done' && (card.owner === 'together' || card.owner === 'me')) return { label: `You said yes · ${placeOf(card, ctx.partner).toLowerCase()}`, tone: 'ok', pending: false };
      if (card.owner === 'table') return { label: 'You passed · back on the table', tone: 'ok', pending: false };
      return { label: placeOf(card, ctx.partner), tone: 'ok', pending: false };
    }
    case 'answer':
      return { label: placeOf(card, ctx.partner), tone: card.owner === 'together' && card.status !== 'done' ? 'partner' : 'ok', pending: false };
    case 'drop': {
      if (cards.length > 1) {
        const n = (f: (c: Card) => boolean) => cards.filter(f).length;
        const parts = [
          [n((c) => c.status !== 'done' && c.owner === 'table'), 'on the table'],
          [n((c) => c.status !== 'done' && (c.owner === 'me' || c.owner === 'together')), 'taken by you'],
          [n((c) => c.status !== 'done' && c.owner === 'partner'), `taken by ${ctx.partner}`],
          [n((c) => c.status === 'done'), 'done'],
        ].filter(([k]) => (k as number) > 0).map(([k, w]) => `${k} ${w}`);
        return { label: parts.join(' · '), tone: 'ok', pending: false };
      }
      if (card.status === 'done') return { label: 'Done', tone: 'ok', pending: false };
      if (card.owner === 'table') return { label: 'On the table', tone: 'ok', pending: false };
      if (card.owner === 'partner') return { label: `Taken by ${ctx.partner}`, tone: 'partner', pending: false };
      return { label: card.owner === 'together' ? 'Doing together' : 'Taken by you', tone: 'ok', pending: false };
    }
    case 'nudge': {
      if (card.status === 'done') return { label: 'Done', tone: 'ok', pending: false };
      if (card.status === 'active' && card.sortAt) {
        const days = Math.max(1, Math.floor((ctx.now - Date.parse(card.sortAt)) / DAY));
        return { label: `Still on your deck · ${days} ${days === 1 ? 'day' : 'days'}`, tone: 'alert', pending: false };
      }
      return { label: placeOf(card, ctx.partner), tone: 'ok', pending: false };
    }
    case 'done': {
      // Once sent, the "Appreciated" chip says it all (Figma 299:25071): no line above it.
      if (ctx.reacted.get(card.id)) return { label: '', tone: 'ok', pending: false, action: 'appreciate' };
      return { label: 'Send an appreciation if it made your day lighter', tone: 'ok', pending: false, action: 'appreciate' };
    }
  }
  return { label: placeOf(card, ctx.partner), tone: 'ok', pending: false };
}

/** Where a tap on an entry (or its push) lands: the place its card lives now. Null: nowhere to go. */
export function destination(kind: string, card: Card | undefined): Destination {
  if (kind === 'sync' || kind === 'thanks') return { path: '/sync' };
  if (kind === 'hand') return { path: '/', focus: { place: 'deck' } };
  if (!card) return null;
  if (card.status === 'done' || kind === 'done') return { path: '/sync' };
  if (forMe(card)) return { path: '/', focus: { id: card.id, place: 'ask' } };
  if (card.owner === 'table') return { path: '/', focus: { id: card.id, place: 'table' } };
  if (card.owner === 'me' || card.owner === 'together') return { path: '/', focus: { id: card.id, place: 'deck' } };
  return { path: '/us', focus: { id: card.id, place: 'partner' } };
}

export type Entry = { key: string; item: ActivityItem; ids: string[]; merged: number };
export type Groups = { needs: Entry[]; today: Entry[]; earlier: Entry[] };

const MERGE = 30 * 60_000;
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Needs you (what waits on my answer), then Today and Earlier, newest first. New cards dropped in
 * one go (within half an hour of each other, the same day) read as one entry.
 */
export function groupActivity(items: ActivityItem[], pending: (i: ActivityItem) => boolean, now: number): Groups {
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const entries: Entry[] = [];
  for (const item of sorted) {
    const last = entries[entries.length - 1];
    const at = Date.parse(item.created_at);
    if (item.kind === 'drop' && last?.item.kind === 'drop') {
      const lastAt = Date.parse(last.item.created_at);
      if (lastAt - at <= MERGE && sameDay(lastAt, at)) {
        last.ids = [...last.ids, ...taskIds(item).filter((id) => !last.ids.includes(id))];
        last.merged += 1;
        continue;
      }
    }
    entries.push({ key: String(item.id), item, ids: taskIds(item), merged: 1 });
  }
  const groups: Groups = { needs: [], today: [], earlier: [] };
  for (const e of entries) {
    if (pending(e.item)) groups.needs.push(e);
    else if (sameDay(Date.parse(e.item.created_at), now)) groups.today.push(e);
    else groups.earlier.push(e);
  }
  return groups;
}
