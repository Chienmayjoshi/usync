import { describe, expect, it } from '@jest/globals';

import { pad2 } from '@/ui/pad2';

import { sheetFollow, sheetSnap } from './deckSheet';

describe('sheetSnap', () => {
  it('settles at the nearer stop when let go slowly', () => {
    expect(sheetSnap(180, 0, 340, 140)).toBe(140);
    expect(sheetSnap(300, 0, 340, 140)).toBe(340);
  });

  it('follows a fling either way, wherever it is', () => {
    expect(sheetSnap(320, -800, 340, 140)).toBe(140);
    expect(sheetSnap(150, 800, 340, 140)).toBe(340);
  });

  it('with no tiles above it there is only one place to be', () => {
    expect(sheetSnap(200, 900, 140, 140)).toBe(140);
  });
});

describe('sheetFollow', () => {
  it('tracks the finger between the stops and resists past them', () => {
    expect(sheetFollow(250, 340, 140)).toBe(250);
    expect(sheetFollow(110, 340, 140)).toBe(130);
    expect(sheetFollow(370, 340, 140)).toBe(350);
    expect(sheetFollow(-400, 340, 140)).toBe(100);
  });
});

describe('pad2', () => {
  it('counts in two digits', () => {
    expect(pad2(7)).toBe('07');
    expect(pad2(17)).toBe('17');
    expect(pad2(120)).toBe('120');
  });
});
