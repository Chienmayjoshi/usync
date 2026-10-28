import { describe, expect, it } from '@jest/globals';

import { balanceTilt, canHandOff, type Card, deckReducer, type DeckState, fakeSort, laterCount, MAX_VISIBLE, myCards, myDeck, splitDrop } from './model';

const card = (id: string, patch: Partial<Card> = {}): Card => ({
  id, title: id, bucket: 'Home', effort: '10 min', when: 'this week', detail: '', owner: 'me', status: 'deal', traded: false, weight: 1, story: [], ...patch,
});
const state = (cards: Card[]): DeckState => ({ cards, album: [], weeksInSync: 0, undo: null, lastDoneId: null });

describe('trade rules', () => {
  it('first trade sends the card to the partner and spends the trade', () => {
    const s = deckReducer(state([card('a')]), { type: 'trade', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'partner', traded: true, status: 'deal' });
  });

  it('a second pass sends the card to the open table, never back to me', () => {
    const s = deckReducer(state([card('a', { traded: true })]), { type: 'trade', id: 'a' });
    expect(s.cards[0].owner).toBe('table');
  });

  it('a card already on my deck can still be traded, and comes back as a deal for them', () => {
    const s = deckReducer(state([card('a', { status: 'active' })]), { type: 'trade', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'partner', traded: true, status: 'deal' });
  });

  it('shared and partner cards are not mine to trade', () => {
    const shared = state([card('a', { status: 'active', owner: 'together' })]);
    expect(deckReducer(shared, { type: 'trade', id: 'a' })).toBe(shared);
    const theirs = state([card('a', { status: 'active', owner: 'partner' })]);
    expect(deckReducer(theirs, { type: 'trade', id: 'a' })).toBe(theirs);
    expect(canHandOff(card('x', { owner: 'partner', status: 'active' }))).toBe(false);
  });

  it('any card of mine can go straight to the open table, trade used or not', () => {
    const s = deckReducer(state([card('a', { status: 'active' }), card('b')]), { type: 'table', id: 'a' });
    expect(s.cards.find((c) => c.id === 'a')).toMatchObject({ owner: 'table', status: 'deal', traded: false });
    expect(myDeck(s).map((c) => c.id)).toEqual(['b']);
  });

  it('taking a card sends it to the back so the next card comes up', () => {
    const s = deckReducer(state([card('a'), card('b')]), { type: 'take', id: 'a' });
    expect(myDeck(s).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('together makes the card active and shared', () => {
    const s = deckReducer(state([card('a')]), { type: 'together', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'together', status: 'active' });
  });
});

describe('done and the album', () => {
  it('done closes the card and adds a story card to the shared album', () => {
    let s = deckReducer(state([card('a')]), { type: 'take', id: 'a' });
    s = deckReducer(s, { type: 'done', id: 'a' });
    expect(s.cards[0].status).toBe('done');
    expect(s.album[0]).toMatchObject({ id: 'a', together: false });
    expect(myDeck(s)).toHaveLength(0);
  });

  it('a deal I already handled can be marked done without taking it first', () => {
    const s = deckReducer(state([card('a')]), { type: 'done', id: 'a' });
    expect(s.cards[0]).toMatchObject({ status: 'done', owner: 'me', doneBy: 'me' });
  });

  it('a done card cannot be closed twice', () => {
    const once = deckReducer(state([card('a')]), { type: 'done', id: 'a' });
    expect(deckReducer(once, { type: 'done', id: 'a' })).toBe(once);
  });
});

describe('undo window', () => {
  it('restores the previous cards and album', () => {
    const start = state([card('a')]);
    const traded = deckReducer(start, { type: 'trade', id: 'a' });
    const back = deckReducer(traded, { type: 'undo' });
    expect(back.cards).toEqual(start.cards);
    expect(back.undo).toBeNull();
  });
});

describe('open table', () => {
  it('anyone can grab a table card and it becomes theirs', () => {
    const s = deckReducer(state([card('a', { owner: 'table', traded: true })]), { type: 'grab', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'me', status: 'active' });
  });
});

describe('seeing every card', () => {
  it('skipping a deal sends it to the back undecided, so the next card shows', () => {
    const s = deckReducer(state([card('a'), card('b')]), { type: 'later', id: 'a' });
    expect(myDeck(s).map((c) => c.id)).toEqual(['b', 'a']);
    expect(s.cards.find((c) => c.id === 'a')?.status).toBe('deal');
  });

  it('the full list holds every open card of mine, past the five on the deck', () => {
    const s = state([...Array.from({ length: 7 }, (_, i) => card(`c${i}`)), card('t', { owner: 'together', status: 'active' }), card('p', { owner: 'partner' })]);
    expect(myCards(s)).toHaveLength(8);
  });
});

describe('deck size', () => {
  it('shows at most five cards and counts the rest as later', () => {
    const s = state(Array.from({ length: 8 }, (_, i) => card(`c${i}`)));
    expect(myDeck(s)).toHaveLength(MAX_VISIBLE);
    expect(laterCount(s)).toBe(3);
  });
});

describe('balance', () => {
  it('is level when both carry the same weight', () => {
    expect(balanceTilt(state([card('a'), card('b', { owner: 'partner' })]))).toBe(0);
  });
  it('tilts toward me when I carry more, and ignores done cards', () => {
    const t = balanceTilt(state([card('a', { weight: 3 }), card('b', { owner: 'partner', weight: 1 }), card('c', { owner: 'partner', status: 'done', weight: 9 })]));
    expect(t).toBeLessThan(0);
  });
});

describe('drop parsing', () => {
  it('splits one line into several cards, including Hinglish joiners', () => {
    expect(splitDrop('kal electrician ko bulana hai aur parcel return karna hai')).toEqual(['kal electrician ko bulana hai', 'parcel return karna hai']);
    expect(splitDrop('bedroom light flickering, call electrician, return the parcel')).toHaveLength(3);
  });
  it('guesses bucket, effort and timing without asking anything', () => {
    expect(fakeSort('kal electrician ko bulana hai')).toMatchObject({ bucket: 'Home', effort: '15 min call', when: 'tomorrow' });
    expect(fakeSort('renew car insurance')).toMatchObject({ bucket: 'Admin', effort: '10 min' });
    expect(fakeSort('plan the goa trip')).toMatchObject({ bucket: 'Us' });
  });
});
