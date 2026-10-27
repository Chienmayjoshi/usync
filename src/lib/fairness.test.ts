import { describe, expect, it } from '@jest/globals';

import { dealTo, type LoadItem, loads, tilt } from './fairness';

const NOW = Date.UTC(2026, 9, 27);
const DAY = 24 * 60 * 60 * 1000;
const item = (owner: LoadItem['owner'], weight: number, patch: Partial<LoadItem> = {}): LoadItem => ({ owner, weight, at: NOW, done: false, ...patch });

describe('fairness', () => {
  it('deals to the lighter partner', () => {
    expect(dealTo([item('a', 4), item('b', 1)], 'b', { now: NOW })).toBe('b');
  });

  it('on a tie the person who did not drop it gets the card', () => {
    expect(dealTo([], 'a', { now: NOW })).toBe('b');
    expect(dealTo([item('a', 2), item('b', 2)], 'b', { now: NOW })).toBe('a');
  });

  it('shared cards count half for each', () => {
    expect(loads([item('together', 4)], NOW)).toEqual({ a: 2, b: 2 });
  });

  it('finished work older than a week stops counting, open work always counts', () => {
    const old = NOW - 9 * DAY;
    expect(loads([item('a', 5, { done: true, at: old }), item('b', 3, { at: old })], NOW)).toEqual({ a: 0, b: 3 });
  });

  it('a shared plan goes to both', () => {
    expect(dealTo([item('a', 9)], 'a', { together: true, now: NOW })).toBe('together');
  });

  it('tilt is negative when I carry more and never leaves [-1, 1]', () => {
    expect(tilt([item('a', 3), item('b', 1)], 'a', NOW)).toBeCloseTo(-0.5);
    expect(tilt([item('a', 3)], 'b', NOW)).toBe(1);
    expect(tilt([], 'a', NOW)).toBe(0);
  });
});
