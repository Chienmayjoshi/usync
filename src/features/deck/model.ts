// Deck domain model: pure state + reducer, no React. The redesign's loop:
// everything unclaimed sits on the shared Table. From the Table I take a card into my deck,
// ask my partner to take it, or ask to do it together. My partner answers requests from their
// deck. Cards on my deck are done, sent back to the Table, or deleted.

import { type Bucket, sortLine } from '@/lib/sorter';

export type { Bucket };
export type Owner = 'me' | 'partner' | 'together' | 'table';
export type Status = 'deal' | 'active' | 'waiting' | 'done';
export type Request = 'take' | 'together' | 'give';

export type Card = {
  id: string;
  title: string;
  bucket: Bucket;
  effort: string;
  when: string;
  detail: string;
  owner: Owner;
  status: Status;
  traded: boolean;
  /** Effort weight used only for the balance shape, never shown as a number. */
  weight: number;
  story: string[];
  /** Set from the backend; absent on locally built cards. */
  doneBy?: 'me' | 'partner' | null;
  doneAt?: string | null;
  waitingNote?: string | null;
  droppedBy?: 'me' | 'partner' | null;
  createdAt?: string;
  /** When it last moved (taken, put back, resumed): how long it has sat, for nudges. */
  sortAt?: string;
  /** An open question about this card, and who asked it. */
  request?: Request | null;
  requestedBy?: 'me' | 'partner' | null;
  /** Only the dropper sees it until it is done. */
  surprise?: boolean;
};

export type StoryCard = { id: string; title: string; when: string; together: boolean; bucket?: Bucket; doneBy?: 'me' | 'partner' | null; doneAt?: string | null };

export type DeckState = {
  cards: Card[];
  album: StoryCard[];
  weeksInSync: number;
  /** Snapshot for the 5 second undo window (rule F7). */
  undo: { cards: Card[]; album: StoryCard[]; label: string } | null;
  lastDoneId: string | null;
};

/** Moves that go to the server's deck_move. */
export type Move = 'grab' | 'ask' | 'together' | 'ask_for' | 'accept' | 'decline' | 'done' | 'table';

export type DeckAction =
  | { type: Move; id: string }
  | { type: 'next'; id: string }
  | { type: 'prev'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'drop'; cards: Card[]; place: DropPlace; surprise?: boolean }
  | { type: 'undo' }
  | { type: 'clearUndo' };

/** Where a new card goes: the shared Table, or straight onto my deck. */
export type DropPlace = 'table' | 'mine';

const update = (cards: Card[], id: string, patch: Partial<Card>) =>
  cards.map((c) => (c.id === id ? { ...c, ...patch, story: patch.story ?? c.story } : c));

const find = (cards: Card[], id: string) => cards.find((c) => c.id === id);

const toFront = (cards: Card[], id: string) => {
  const c = find(cards, id);
  return c ? [c, ...cards.filter((x) => x.id !== id)] : cards;
};

const toBack = (cards: Card[], id: string) => {
  const c = find(cards, id);
  return c ? [...cards.filter((x) => x.id !== id), c] : cards;
};

const open = (c: Card) => c.status === 'deal' || c.status === 'active';
/** A request my partner made that waits on my answer. */
export const forMe = (c: Card) => !!c.request && c.requestedBy === 'partner';
const cleared = { request: null, requestedBy: null } as const;

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  const snapshot = (label: string) => ({ cards: state.cards, album: state.album, label });
  if (action.type === 'undo') return state.undo ? { ...state, cards: state.undo.cards, album: state.undo.album, undo: null } : state;
  if (action.type === 'clearUndo') return { ...state, undo: null };
  if (action.type === 'drop') return { ...state, cards: [...state.cards, ...action.cards] };

  const c = find(state.cards, action.id);
  if (!c) return state;
  const move = (patch: Partial<Card>, note: string, label: string, back = true) => {
    const cards = update(state.cards, c.id, { ...patch, story: [...c.story, note] });
    return { ...state, cards: back ? toBack(cards, c.id) : cards, undo: snapshot(label) };
  };

  switch (action.type) {
    case 'next':
      // Not now: the next card on the Table comes up. Local only, nothing changes for anyone.
      return { ...state, cards: toBack(state.cards, c.id) };
    case 'prev':
      // Back a card: the one you passed last returns to the front. Local only, like next.
      return { ...state, cards: toFront(state.cards, c.id) };
    case 'grab':
      if (c.status === 'done' || !(c.owner === 'table' || (c.request === 'take' && c.owner === 'me'))) return state;
      return move({ owner: 'me', status: 'active', ...cleared }, 'You took it', 'Taken');
    case 'ask':
      if (!open(c) || !(c.owner === 'table' || c.owner === 'me')) return state;
      return move({ owner: 'partner', status: 'deal', request: 'take', requestedBy: 'me', traded: true }, 'You asked your partner to take it', 'Asked');
    case 'together':
      if (c.status !== 'deal' || c.owner !== 'table') return state;
      return move({ owner: 'together', request: 'together', requestedBy: 'me' }, 'You asked to do it together', 'Asked to share');
    case 'ask_for':
      if (c.status !== 'active' || c.owner !== 'partner' || c.request) return state;
      return move({ request: 'give', requestedBy: 'me' }, 'You asked for it', 'Asked for it', false);
    case 'accept':
      if (!forMe(c)) return state;
      if (c.request === 'take' && c.owner === 'me') return move({ status: 'active', ...cleared }, 'You took it', 'Taken');
      if (c.request === 'together') return move({ status: 'active', ...cleared }, 'Doing it together', 'Doing it together');
      if (c.request === 'give' && c.owner === 'me') return move({ owner: 'partner', ...cleared }, 'You gave it away', 'Given');
      return state;
    case 'decline':
      if (!forMe(c)) return state;
      if (c.request === 'give') return move({ ...cleared }, 'You kept it', 'Kept', false);
      return move({ owner: 'table', status: 'deal', ...cleared }, 'Back on the table', 'Back on the table');
    case 'table':
      if (c.owner === 'table' || !(c.status === 'deal' || (c.status === 'active' && (c.owner === 'me' || c.owner === 'together')))) return state;
      return move({ owner: 'table', status: 'deal', ...cleared }, 'Back on the table', 'Back on the table');
    case 'done': {
      if (c.status === 'done') return state;
      const story: StoryCard = { id: c.id, title: c.title, when: 'This week', together: c.owner === 'together', bucket: c.bucket, doneBy: 'me', doneAt: new Date().toISOString() };
      const owner = c.status === 'deal' && c.owner !== 'together' ? 'me' : c.owner;
      return {
        ...state,
        cards: update(state.cards, c.id, { status: 'done', owner, doneBy: 'me', doneAt: story.doneAt, ...cleared, story: [...c.story, 'Done'] }),
        album: [story, ...state.album],
        lastDoneId: c.id,
        undo: snapshot('Done'),
      };
    }
    case 'delete':
      return { ...state, cards: state.cards.filter((x) => x.id !== c.id), undo: null };
  }
}

/** The shared pool: nobody owns these yet. */
export const tableCards = (s: DeckState) => s.cards.filter((c) => c.owner === 'table' && c.status === 'deal');

/**
 * My deck: requests waiting on my answer first, then what I carry (alone or together),
 * including cards parked while I wait on someone else.
 */
export function deckCards(s: DeckState): Card[] {
  const asks = s.cards.filter((c) => forMe(c) && c.status !== 'done' && (c.owner === 'me' || c.owner === 'together'));
  const carried = s.cards.filter((c) => !c.request && (c.owner === 'me' || c.owner === 'together') && (c.status === 'active' || c.status === 'waiting'));
  return [...asks, ...carried];
}

/** My partner's side: what they carry, and what I asked them to take or share. */
export const partnerDeck = (s: DeckState) =>
  s.cards.filter((c) => c.status !== 'done' && (c.owner === 'partner' || (c.owner === 'together' && c.requestedBy === 'me' && c.request === 'together')));

export const togetherCards = (s: DeckState) => s.cards.filter((c) => c.owner === 'together' && c.status !== 'done' && !c.request);
export const waitingCards = (s: DeckState) => s.cards.filter((c) => c.status === 'waiting');

/** The redesign's filters. "This week" is anything due within the week; the rest is later. */
export type When = 'all' | 'week' | 'later';
const LATER = /\b(next week|next month|this month|later|someday)\b/i;
export const isLater = (c: Card) => LATER.test(c.when);
export function byWhen(cards: Card[], w: When): Card[] {
  if (w === 'all') return cards;
  return cards.filter((c) => (w === 'later' ? isLater(c) : !isLater(c)));
}

/** A short job, worth flagging as a quick pick. */
export const isQuick = (c: Card) => c.weight <= 1 && /\b(min|minute|quick|call)\b/i.test(c.effort);

/**
 * Balance tilt in [-1, 1]: negative = I carry more. Shared cards count for both.
 * Only ever rendered as a seesaw angle, never as numbers (rule F2).
 */
export function balanceTilt(s: DeckState): number {
  let me = 0;
  let partner = 0;
  for (const c of s.cards) {
    if (c.status === 'done' || c.request) continue;
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
/** Local card from one line, using the free rule sorter. The backend stores the same fields. */
export function fakeSort(raw: string, place: DropPlace = 'table', surprise = false): Card {
  const s = sortLine(raw);
  seq += 1;
  const mine = place === 'mine';
  return {
    id: `drop-${Date.now()}-${seq}`,
    title: s.title,
    bucket: s.bucket,
    effort: s.effort,
    when: s.when,
    detail: '',
    owner: mine ? 'me' : 'table',
    status: mine ? 'active' : 'deal',
    traded: false,
    weight: s.weight,
    story: ['You added it'],
    droppedBy: 'me',
    surprise: mine && surprise,
  };
}
