import { describe, expect, it } from '@jest/globals';

import { REACTIONS, reactionLine, reactionOf } from './reactions';

describe('reactions', () => {
  it('offers the four from the design, in order', () => {
    expect(REACTIONS.map((r) => r.emoji)).toEqual(['👍', '❤️', '😊', '🎉']);
  });

  it('reads as the partner sees it', () => {
    expect(reactionLine('thumbs', 'Chinmay')).toBe('Chinmay gave you a thumbs up 👍');
    expect(reactionLine('party', 'Chinmay')).toBe('Chinmay is celebrating this 🎉');
    expect(reactionLine(undefined, 'Chinmay')).toBe('Chinmay sent you a heart ❤️');
    expect(reactionOf('nope').key).toBe('heart');
  });

  it('still shows reactions sent before the four', () => {
    expect(reactionOf('care').emoji).toBe('🤗');
  });
});
