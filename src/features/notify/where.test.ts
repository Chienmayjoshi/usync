import { describe, expect, it } from '@jest/globals';

import type { Card } from '@/features/deck/model';

import { type ActivityItem, destination, groupActivity, liveStatus } from './where';

const card = (id: string, patch: Partial<Card> = {}): Card => ({
  id, title: id, bucket: 'Home', effort: '10 min', when: 'this week', detail: '', owner: 'table', status: 'deal', traded: false, weight: 1, story: [], ...patch,
});
const NOW = Date.parse('2026-11-11T12:00:00');
const item = (id: number, kind: string, data: ActivityItem['data'], at = '2026-11-11T10:00:00'): ActivityItem => ({ id, kind, title: kind, body: '', created_at: at, data });
const ctx = (cards: Card[], reacted = new Map()) => ({ cards, partner: 'B', reacted, now: NOW });

describe('live status', () => {
  it('keeps an ask waiting until it is answered', () => {
    const ask = card('a', { owner: 'together', request: 'together', requestedBy: 'partner' });
    expect(liveStatus(item(1, 'request', { task_id: 'a', request: 'together' }), ctx([ask]))).toMatchObject({ label: 'Waiting on you', pending: true, action: 'answer' });
    const yes = card('a', { owner: 'together', status: 'active' });
    expect(liveStatus(item(1, 'request', { task_id: 'a', request: 'together' }), ctx([yes]))?.label).toBe('You said yes · doing together');
    expect(liveStatus(item(1, 'request', { task_id: 'a' }), ctx([card('a')]))?.label).toBe('You passed · back on the table');
  });

  it('says a card is gone when it is', () => {
    expect(liveStatus(item(1, 'nudge', { task_id: 'x' }), ctx([]))).toMatchObject({ label: 'No longer here', tone: 'muted' });
  });

  it('counts how long a nudged card has sat', () => {
    const c = card('n', { owner: 'me', status: 'active', sortAt: '2026-11-04T12:00:00' });
    expect(liveStatus(item(1, 'nudge', { task_id: 'n' }), ctx([c]))).toMatchObject({ label: 'Still on your deck · 7 days', tone: 'alert' });
  });

  it('offers an appreciation until one is sent', () => {
    const c = card('d', { owner: 'partner', status: 'done', doneBy: 'partner' });
    expect(liveStatus(item(1, 'done', { task_id: 'd' }), ctx([c]))?.action).toBe('appreciate');
    expect(liveStatus(item(1, 'done', { task_id: 'd' }), ctx([c], new Map([['d', 'heart']])))?.label).toBe('');
  });

  it('sums up a burst of new cards', () => {
    const cs = [card('1'), card('2'), card('3', { owner: 'me', status: 'active' })];
    expect(liveStatus(item(1, 'drop', { task_ids: ['1', '2', '3'] }), ctx(cs))?.label).toBe('2 on the table · 1 taken by you');
  });
});

describe('where a tap lands', () => {
  it('goes where the card is now', () => {
    expect(destination('drop', card('t'))).toEqual({ path: '/', focus: { id: 't', place: 'table' } });
    expect(destination('request', card('a', { owner: 'me', request: 'take', requestedBy: 'partner' }))).toEqual({ path: '/', focus: { id: 'a', place: 'ask' } });
    expect(destination('nudge', card('m', { owner: 'together', status: 'active' }))).toEqual({ path: '/', focus: { id: 'm', place: 'deck' } });
    expect(destination('drop', card('p', { owner: 'partner', status: 'active' }))).toEqual({ path: '/us', focus: { id: 'p', place: 'partner' } });
    expect(destination('done', card('d', { status: 'done' }))).toEqual({ path: '/sync' });
    expect(destination('nudge', undefined)).toBeNull();
  });
});

describe('grouping', () => {
  it('puts what waits on me first, then today and earlier, merging a burst of drops', () => {
    const items = [
      item(1, 'drop', { task_ids: ['a'] }, '2026-11-11T10:00:00'),
      item(2, 'drop', { task_ids: ['b'] }, '2026-11-11T10:20:00'),
      item(3, 'request', { task_id: 'r' }, '2026-11-11T09:00:00'),
      item(4, 'thanks', { task_id: 'h' }, '2026-11-09T09:00:00'),
    ];
    const g = groupActivity(items, (i) => i.kind === 'request', NOW);
    expect(g.needs.map((e) => e.item.id)).toEqual([3]);
    expect(g.today).toHaveLength(1);
    expect(g.today[0]).toMatchObject({ merged: 2, ids: ['b', 'a'] });
    expect(g.earlier.map((e) => e.item.id)).toEqual([4]);
  });
});
