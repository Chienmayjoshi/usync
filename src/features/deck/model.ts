// Deck domain model: pure state + reducer, no React. Mirrors the core loop in the plan:
// a dealt card can be taken, traded once (then it goes to the open table), or done together.

import { type Bucket, sortLine } from '@/lib/sorter';

export type { Bucket };
export type Owner = 'me' | 'partner' | 'together' | 'table';
export type Status = 'deal' | 'active' | 'waiting' | 'done';

export type Card = {
  id: string;
  title: string;
  bucket: Bucket;
  effort: string;
  when: string;
  detail: string;
  owner: Owner;
  status: Status;
  /** The one trade a card gets. After it, a pass sends the card to the open table. */
  traded: boolean;
  /** Effort weight used only for the balance shape, never shown as a number. */
  weight: number;
  story: string[];
};

export type StoryCard = { id: string; title: string; when: string; together: boolean };

export type DeckState = {
  cards: Card[];
  album: StoryCard[];
  weeksInSync: number;
  /** Snapshot for the 5 second undo window (rule F7). */
  undo: { cards: Card[]; album: StoryCard[]; label: string } | null;
  lastDoneId: string | null;
};

export type DeckAction =
  | { type: 'take'; id: string }
  | { type: 'trade'; id: string }
  | { type: 'together'; id: string }
  | { type: 'done'; id: string }
  | { type: 'later'; id: string }
  | { type: 'grab'; id: string }
  | { type: 'drop'; cards: Card[] }
  | { type: 'undo' }
  | { type: 'clearUndo' };

export const MAX_VISIBLE = 5;

const update = (cards: Card[], id: string, patch: Partial<Card>) =>
  cards.map((c) => (c.id === id ? { ...c, ...patch, story: patch.story ?? c.story } : c));

const find = (cards: Card[], id: string) => cards.find((c) => c.id === id);

/** Moves a card to the back of the pile, so the next card in the hand comes up. */
const toBack = (cards: Card[], id: string) => {
  const c = find(cards, id);
  return c ? [...cards.filter((x) => x.id !== id), c] : cards;
};

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  const snapshot = (label: string) => ({ cards: state.cards, album: state.album, label });
  switch (action.type) {
    case 'take': {
      const c = find(state.cards, action.id);
      if (!c || c.status !== 'deal') return state;
      return { ...state, cards: toBack(update(state.cards, c.id, { owner: 'me', status: 'active', story: [...c.story, 'You took it'] }), c.id), undo: snapshot('Taken') };
    }
    case 'trade': {
      const c = find(state.cards, action.id);
      if (!c || c.status !== 'deal') return state;
      if (!c.traded) {
        return { ...state, cards: update(state.cards, c.id, { owner: 'partner', traded: true, story: [...c.story, 'Traded to Meera'] }), undo: snapshot('Traded to Meera') };
      }
      // The trade is used: passing again puts it on the open table, never back and forth.
      return { ...state, cards: update(state.cards, c.id, { owner: 'table', story: [...c.story, 'Passed to the open table'] }), undo: snapshot('Passed to the table') };
    }
    case 'together': {
      const c = find(state.cards, action.id);
      if (!c || c.status !== 'deal') return state;
      return { ...state, cards: toBack(update(state.cards, c.id, { owner: 'together', status: 'active', story: [...c.story, 'Doing it together'] }), c.id), undo: snapshot('Doing it together') };
    }
    case 'later': {
      const c = find(state.cards, action.id);
      if (!c || c.status !== 'active') return state;
      // Not this week: leaves the deck by moving to the back of the pile.
      const rest = state.cards.filter((x) => x.id !== c.id);
      return { ...state, cards: [...rest, { ...c, story: [...c.story, 'Moved to later'] }], undo: snapshot('Moved to later') };
    }
    case 'grab': {
      const c = find(state.cards, action.id);
      if (!c || c.owner !== 'table') return state;
      return { ...state, cards: update(state.cards, c.id, { owner: 'me', status: 'active', story: [...c.story, 'Grabbed from the table'] }), undo: snapshot('Grabbed') };
    }
    case 'done': {
      const c = find(state.cards, action.id);
      if (!c || c.status !== 'active') return state;
      const story: StoryCard = { id: c.id, title: c.title, when: 'This week', together: c.owner === 'together' };
      return {
        ...state,
        cards: update(state.cards, c.id, { status: 'done', story: [...c.story, 'Done'] }),
        album: [story, ...state.album],
        lastDoneId: c.id,
        undo: snapshot('Done'),
      };
    }
    case 'drop':
      return { ...state, cards: [...state.cards, ...action.cards] };
    case 'undo':
      if (!state.undo) return state;
      return { ...state, cards: state.undo.cards, album: state.undo.album, undo: null };
    case 'clearUndo':
      return { ...state, undo: null };
  }
}

/** Cards on my deck right now: deals and active cards I own or share, capped at five. */
export function myDeck(state: DeckState): Card[] {
  return state.cards
    .filter((c) => (c.owner === 'me' || c.owner === 'together') && (c.status === 'deal' || c.status === 'active'))
    .slice(0, MAX_VISIBLE);
}

export function laterCount(state: DeckState): number {
  const mine = state.cards.filter((c) => (c.owner === 'me' || c.owner === 'together') && (c.status === 'deal' || c.status === 'active'));
  return Math.max(0, mine.length - MAX_VISIBLE);
}

export const partnerCards = (s: DeckState) => s.cards.filter((c) => c.owner === 'partner' && c.status !== 'done');
export const tableCards = (s: DeckState) => s.cards.filter((c) => c.owner === 'table' && c.status !== 'done');
export const waitingCards = (s: DeckState) => s.cards.filter((c) => c.status === 'waiting');

/**
 * Balance tilt in [-1, 1]: negative = I carry more. Shared cards count for both.
 * Only ever rendered as a seesaw angle, never as numbers (rule F2).
 */
export function balanceTilt(s: DeckState): number {
  let me = 0;
  let partner = 0;
  for (const c of s.cards) {
    if (c.status === 'done') continue;
    if (c.owner === 'me') me += c.weight;
    else if (c.owner === 'partner') partner += c.weight;
    else if (c.owner === 'together') { me += c.weight / 2; partner += c.weight / 2; }
  }
  const total = me + partner;
  if (total === 0) return 0;
  return Math.max(-1, Math.min(1, (partner - me) / total));
}

export { splitDrop } from '@/lib/sorter';

let seq = 0;
/** Local card from one line, using the free rule sorter. The backend version stores the same fields. */
export function fakeSort(raw: string): Card {
  const s = sortLine(raw);
  seq += 1;
  return {
    id: `drop-${Date.now()}-${seq}`,
    title: s.title,
    bucket: s.bucket,
    effort: s.effort,
    when: s.when,
    detail: 'Dropped just now. Dealt to you for this demo; with Meera paired it goes into tonight’s hand.',
    owner: s.together ? 'together' : 'me',
    status: 'deal',
    traded: false,
    weight: s.weight,
    story: ['You dropped it'],
  };
}
