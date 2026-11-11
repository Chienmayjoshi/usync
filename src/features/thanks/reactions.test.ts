import { describe, expect, it } from '@jest/globals';

import { reactionLine, reactionOf, slotAt } from './reactions';

describe('reactions', () => {
  it('reads as the partner sees it', () => {
    expect(reactionLine('care', 'Chinmay')).toBe('Chinmay sent you a hug 🤗');
    expect(reactionLine(undefined, 'Chinmay')).toBe('Chinmay sent you a heart ❤️');
    expect(reactionOf('nope').key).toBe('heart');
  });

  it('finds the emoji under the finger', () => {
    expect(slotAt(10, 220)).toBe(0);
    expect(slotAt(219, 220)).toBe(4);
    expect(slotAt(-1, 220)).toBeNull();
    expect(slotAt(230, 220)).toBeNull();
  });
});
