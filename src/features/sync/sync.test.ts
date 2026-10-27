import { describe, expect, it } from '@jest/globals';

import { weekStart, weeksInSync } from './weeks';

describe('sync weeks', () => {
  it('weeks start on Monday, like Postgres', () => {
    expect(weekStart(new Date(2026, 9, 27))).toBe('2026-10-26'); // Tuesday
    expect(weekStart(new Date(2026, 10, 1))).toBe('2026-10-26'); // Sunday closes the same week
    expect(weekStart(new Date(2026, 10, 2))).toBe('2026-11-02'); // Monday starts a new one
  });

  it('counts only weeks where both wrote, and a gap never resets the count', () => {
    const e = (member: string, week_start: string) => ({ member, week_start, appreciation: 'x' });
    expect(weeksInSync([e('a', '2026-10-05'), e('b', '2026-10-05'), e('a', '2026-10-12'), e('a', '2026-10-19'), e('b', '2026-10-19')])).toBe(2);
  });
});
