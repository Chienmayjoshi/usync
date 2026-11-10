import { describe, expect, it } from '@jest/globals';

import { dueFor, postponed, revealLabel, revealOn, stepFromText, whenFor } from './priority';

// Wed 11 Nov 2026, midday local.
const WED = new Date(2026, 10, 11, 12).getTime();

describe('the knob follows the words', () => {
  it('reads a day from the line', () => {
    expect(stepFromText('call the electrician today')).toBe('today');
    expect(stepFromText('kal bijli ka bill')).toBe('days2');
    expect(stepFromText('renew insurance by friday')).toBe('week');
    expect(stepFromText('plan goa next month')).toBe('later');
  });

  it('says nothing when the line names no time', () => {
    expect(stepFromText('call the electrician')).toBeNull();
    expect(stepFromText('')).toBeNull();
  });

  it('keeps the precise words when they agree with the stop, else the stop', () => {
    expect(whenFor('week', 'renew insurance by friday')).toBe('by Friday');
    expect(whenFor('today', 'renew insurance by friday')).toBe('today');
    expect(whenFor('later', 'call the electrician')).toBe('later');
    expect(whenFor('days2', 'call the electrician')).toBe('in 2 days');
  });
});

describe('dates', () => {
  it('turns each stop into a day', () => {
    expect(dueFor('today', WED)).toBe('2026-11-11');
    expect(dueFor('days2', WED)).toBe('2026-11-13');
    expect(dueFor('week', WED)).toBe('2026-11-15');
    expect(dueFor('later', WED)).toBe('2026-11-25');
  });

  it('makes "this week" today when today is Sunday', () => {
    expect(dueFor('week', new Date(2026, 10, 15, 9).getTime())).toBe('2026-11-15');
  });
});

describe('a surprise reveal', () => {
  it('rolls on to today once its day has passed', () => {
    expect(revealOn('2026-11-08', WED).getDate()).toBe(11);
    expect(revealLabel('2026-11-08', WED)).toBe('Reveal today');
  });

  it('names the day', () => {
    expect(revealLabel('2026-11-12', WED)).toBe('Reveal tomorrow');
    expect(revealLabel('2026-11-13', WED)).toMatch(/^Reveal by Fri/);
    expect(revealLabel('2026-11-25', WED)).toMatch(/^Reveal by 25 Nov/);
  });

  it('moves a day later from where it shows, not from a past date', () => {
    expect(postponed('2026-11-13', WED)).toBe('2026-11-14');
    expect(postponed('2026-11-01', WED)).toBe('2026-11-12');
    expect(postponed('2026-11-14', WED, -1)).toBe('2026-11-13');
  });
});
