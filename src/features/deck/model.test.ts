import { describe, expect, it } from '@jest/globals';

import { arrange, balanceTilt, byWhen, type Card, deckCards, deckReducer, type DeckState, fakeSort, partnerDeck, splitDrop, tableCards } from './model';

const card = (id: string, patch: Partial<Card> = {}): Card => ({
  id, title: id, bucket: 'Home', effort: '10 min', when: 'this week', detail: '', owner: 'table', status: 'deal', traded: false, weight: 1, story: [], ...patch,
});
const state = (cards: Card[]): DeckState => ({ cards, album: [], weeksInSync: 0, undo: null, lastDoneId: null });

describe('the table', () => {
  it('grabbing a table card puts it on my deck', () => {
    const s = deckReducer(state([card('a')]), { type: 'grab', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'me', status: 'active' });
    expect(deckCards(s).map((c) => c.id)).toEqual(['a']);
    expect(tableCards(s)).toHaveLength(0);
  });

  it('next moves the top card to the back without changing it', () => {
    const s = deckReducer(state([card('a'), card('b')]), { type: 'next', id: 'a' });
    expect(tableCards(s).map((c) => c.id)).toEqual(['b', 'a']);
    expect(s.cards[1]).toMatchObject({ owner: 'table', status: 'deal' });
    expect(s.undo).toBeNull();
  });

  it('prev brings a card back to the front, undoing next', () => {
    const start = state([card('a'), card('b'), card('c')]);
    const passed = deckReducer(start, { type: 'next', id: 'a' });
    expect(tableCards(passed).map((c) => c.id)).toEqual(['b', 'c', 'a']);
    const back = deckReducer(passed, { type: 'prev', id: 'a' });
    expect(tableCards(back).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(back.undo).toBeNull();
  });

  it('asking my partner sends the card to them as a request', () => {
    const s = deckReducer(state([card('a')]), { type: 'ask', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'partner', status: 'deal', request: 'take', requestedBy: 'me' });
    expect(partnerDeck(s).map((c) => c.id)).toEqual(['a']);
  });

  it('do it together stays a pending request until my partner says yes', () => {
    const s = deckReducer(state([card('a')]), { type: 'together', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'together', status: 'deal', request: 'together' });
    expect(deckCards(s)).toHaveLength(0);
  });
});

describe('requests on my deck', () => {
  const asked = card('a', { owner: 'me', status: 'deal', request: 'take', requestedBy: 'partner' });
  const shared = card('b', { owner: 'together', status: 'deal', request: 'together', requestedBy: 'partner' });
  const wanted = card('c', { owner: 'me', status: 'active', request: 'give', requestedBy: 'partner' });

  it('requests come first on my deck', () => {
    const s = state([card('x', { owner: 'me', status: 'active' }), asked]);
    expect(deckCards(s).map((c) => c.id)).toEqual(['a', 'x']);
  });

  it('take it, yes together and give it each resolve the request', () => {
    expect(deckReducer(state([asked]), { type: 'accept', id: 'a' }).cards[0]).toMatchObject({ owner: 'me', status: 'active', request: null });
    expect(deckReducer(state([shared]), { type: 'accept', id: 'b' }).cards[0]).toMatchObject({ owner: 'together', status: 'active', request: null });
    expect(deckReducer(state([wanted]), { type: 'accept', id: 'c' }).cards[0]).toMatchObject({ owner: 'partner', status: 'active', request: null });
  });

  it('not this one and not now send the card back to the table; keep it keeps it', () => {
    expect(deckReducer(state([asked]), { type: 'decline', id: 'a' }).cards[0]).toMatchObject({ owner: 'table', status: 'deal', request: null });
    expect(deckReducer(state([shared]), { type: 'decline', id: 'b' }).cards[0]).toMatchObject({ owner: 'table', request: null });
    expect(deckReducer(state([wanted]), { type: 'decline', id: 'c' }).cards[0]).toMatchObject({ owner: 'me', status: 'active', request: null });
  });

  it('I cannot answer my own request', () => {
    const mine = state([card('a', { owner: 'partner', request: 'take', requestedBy: 'me' })]);
    expect(deckReducer(mine, { type: 'accept', id: 'a' })).toBe(mine);
  });

  it('I can ask for a card on my partner’s deck', () => {
    const s = deckReducer(state([card('a', { owner: 'partner', status: 'active' })]), { type: 'ask_for', id: 'a' });
    expect(s.cards[0]).toMatchObject({ owner: 'partner', request: 'give', requestedBy: 'me' });
  });
});

describe('my deck', () => {
  it('done closes the card and adds a story card to the shared album', () => {
    const s = deckReducer(state([card('a', { owner: 'me', status: 'active' })]), { type: 'done', id: 'a' });
    expect(s.cards[0].status).toBe('done');
    expect(s.album[0]).toMatchObject({ id: 'a', together: false });
    expect(deckCards(s)).toHaveLength(0);
  });

  it('a done card cannot be closed twice', () => {
    const once = deckReducer(state([card('a', { owner: 'me', status: 'active' })]), { type: 'done', id: 'a' });
    expect(deckReducer(once, { type: 'done', id: 'a' })).toBe(once);
  });

  it('back to table works for my cards and shared ones, not my partner’s', () => {
    expect(deckReducer(state([card('a', { owner: 'me', status: 'active' })]), { type: 'table', id: 'a' }).cards[0].owner).toBe('table');
    expect(deckReducer(state([card('a', { owner: 'together', status: 'active' })]), { type: 'table', id: 'a' }).cards[0].owner).toBe('table');
    const theirs = state([card('a', { owner: 'partner', status: 'active' })]);
    expect(deckReducer(theirs, { type: 'table', id: 'a' })).toBe(theirs);
  });

  it('delete removes the card', () => {
    expect(deckReducer(state([card('a'), card('b')]), { type: 'delete', id: 'a' }).cards.map((c) => c.id)).toEqual(['b']);
  });

  it('waiting cards stay on my deck', () => {
    expect(deckCards(state([card('a', { owner: 'me', status: 'waiting' })]))).toHaveLength(1);
  });
});

describe('undo window', () => {
  it('restores the previous cards and album', () => {
    const start = state([card('a')]);
    const back = deckReducer(deckReducer(start, { type: 'ask', id: 'a' }), { type: 'undo' });
    expect(back.cards).toEqual(start.cards);
    expect(back.undo).toBeNull();
  });
});

describe('filters', () => {
  it('splits this week from later', () => {
    const cards = [card('a'), card('b', { when: 'next week' }), card('c', { when: 'tomorrow' }), card('d', { when: 'next month' })];
    expect(byWhen(cards, 'week').map((c) => c.id)).toEqual(['a', 'c']);
    expect(byWhen(cards, 'later').map((c) => c.id)).toEqual(['b', 'd']);
    expect(byWhen(cards, 'all')).toHaveLength(4);
  });
});

describe('balance', () => {
  it('is level when both carry the same weight', () => {
    expect(balanceTilt(state([card('a', { owner: 'me', status: 'active' }), card('b', { owner: 'partner', status: 'active' })]))).toBe(0);
  });
  it('tilts toward me when I carry more, and ignores done cards and open requests', () => {
    const t = balanceTilt(state([
      card('a', { owner: 'me', weight: 3, status: 'active' }), card('b', { owner: 'partner', weight: 1, status: 'active' }),
      card('c', { owner: 'partner', status: 'done', weight: 9 }), card('d', { owner: 'partner', weight: 9, request: 'take', requestedBy: 'me' }),
    ]));
    expect(t).toBeLessThan(0);
  });
});

describe('adding', () => {
  it('splits one line into several cards, including Hinglish joiners', () => {
    expect(splitDrop('kal electrician ko bulana hai aur parcel return karna hai')).toEqual(['kal electrician ko bulana hai', 'parcel return karna hai']);
    expect(splitDrop('bedroom light flickering, call electrician, return the parcel')).toHaveLength(3);
  });
  it('guesses bucket, effort and timing without asking anything', () => {
    expect(fakeSort('kal electrician ko bulana hai')).toMatchObject({ bucket: 'Home', effort: '15 min call', when: 'tomorrow' });
    expect(fakeSort('renew car insurance')).toMatchObject({ bucket: 'Admin', effort: '10 min' });
    expect(fakeSort('plan the goa trip')).toMatchObject({ bucket: 'Us' });
  });
  it('lands on the table by default, or on my deck; a surprise only on my deck', () => {
    expect(fakeSort('return the parcel')).toMatchObject({ owner: 'table', status: 'deal', surprise: false });
    expect(fakeSort('pottery class', 'mine', true)).toMatchObject({ owner: 'me', status: 'active', surprise: true });
    expect(fakeSort('pottery class', 'table', true).surprise).toBe(false);
  });
});

describe('stack order', () => {
  const t = (id: string, sortAt: string, patch: Partial<Card> = {}) => card(id, { owner: 'table', status: 'deal', sortAt, ...patch });

  it('puts the newest Table card first on the first load', () => {
    const rows = [t('old', '2026-11-01'), t('mid', '2026-11-05'), t('new', '2026-11-08')];
    expect(arrange(rows, []).map((c) => c.id)).toEqual(['new', 'mid', 'old']);
  });

  it('keeps the order you left it in, and brings a just added card to the front', () => {
    const shown = [t('b', '2026-11-05'), t('a', '2026-11-01')];
    const rows = [t('a', '2026-11-01'), t('b', '2026-11-05'), t('added', '2026-11-09')];
    expect(arrange(rows, shown).map((c) => c.id)).toEqual(['added', 'b', 'a']);
  });

  it('brings a card back to the front when it returns to the Table from elsewhere', () => {
    const shown = [t('a', '2026-11-01'), card('x', { owner: 'together', request: 'together', requestedBy: 'me' })];
    const rows = [t('a', '2026-11-01'), t('x', '2026-11-09')];
    expect(arrange(rows, shown).map((c) => c.id)).toEqual(['x', 'a']);
  });

  it('drops a just added card on top of the stack locally too', () => {
    const s = deckReducer(state([t('a', '2026-11-01')]), { type: 'drop', cards: [t('n', '2026-11-09')], place: 'table' });
    expect(s.cards[0].id).toBe('n');
  });
});
