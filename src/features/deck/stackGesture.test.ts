import { describe, expect, it } from '@jest/globals';

import { dropCommits, HOLD_MS, intentOf, sideCommits, stepCommits } from './stackGesture';

describe('intentOf', () => {
  it('reads quick moves by direction', () => {
    expect(intentOf(2, -20, 40, true)).toBe('restack');
    expect(intentOf(2, 20, 40, true)).toBe('back');
    expect(intentOf(30, 10, 40, true)).toBe('swipe');
    expect(intentOf(-30, 10, 40, true)).toBe('swipe');
  });

  it('carries the card after a hold, any direction', () => {
    expect(intentOf(0, 20, HOLD_MS, true)).toBe('drag');
    expect(intentOf(30, -5, HOLD_MS + 100, true)).toBe('drag');
  });

  it('with nowhere to drop it, a hold then move is just a swipe', () => {
    expect(intentOf(0, 20, HOLD_MS + 100, false)).toBe('back');
    expect(intentOf(0, -20, HOLD_MS + 100, false)).toBe('restack');
  });
});

describe('stepCommits', () => {
  it('needs distance or a fling in its own direction', () => {
    expect(stepCommits(-60, 0, -1)).toBe(true);
    expect(stepCommits(-20, -800, -1)).toBe(true);
    expect(stepCommits(-20, -100, -1)).toBe(false);
    expect(stepCommits(60, 0, -1)).toBe(false);
    expect(stepCommits(60, 0, 1)).toBe(true);
    expect(stepCommits(10, 700, 1)).toBe(true);
  });
});

describe('dropCommits', () => {
  it('takes it over the pill, or most of the way there', () => {
    expect(dropCommits(0, true, 0)).toBe(true);
    expect(dropCommits(0.7, false, 0)).toBe(true);
    expect(dropCommits(0.4, false, 1000)).toBe(true);
    expect(dropCommits(0.4, false, 200)).toBe(false);
    expect(dropCommits(0.1, false, 2000)).toBe(false);
  });
});

describe('sideCommits', () => {
  it('commits on distance or a fling, each way', () => {
    expect(sideCommits(70, 0)).toBe('right');
    expect(sideCommits(-70, 0)).toBe('left');
    expect(sideCommits(20, 600)).toBe('right');
    expect(sideCommits(-20, -600)).toBe('left');
  });

  it('lets a drift or a fling back to the middle spring home', () => {
    expect(sideCommits(30, 100)).toBeNull();
    expect(sideCommits(-30, 800)).toBeNull();
    expect(sideCommits(0, 0)).toBeNull();
  });
});
