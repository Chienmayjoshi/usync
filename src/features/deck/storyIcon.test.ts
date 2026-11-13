import { describe, expect, it } from '@jest/globals';

import { storyIcon } from './storyIcon';

describe('storyIcon', () => {
  it('reads the lines the app writes', () => {
    expect(storyIcon('Chinmay added it')).toBe('added');
    expect(storyIcon('Bhagyashree asked their partner to take it')).toBe('asked');
    expect(storyIcon('Undone')).toBe('undone');
    expect(storyIcon('Chinmay took it from the table')).toBe('took');
    expect(storyIcon('Chinmay put it back on the table')).toBe('back');
    expect(storyIcon('Task complete')).toBe('done');
    expect(storyIcon('Done')).toBe('done');
    expect(storyIcon('Doing it together')).toBe('together');
    expect(storyIcon('You asked to do it together')).toBe('together');
  });

  it('falls back to a plain dot, whatever the case', () => {
    expect(storyIcon('Something else happened')).toBe('other');
    expect(storyIcon('TOOK IT')).toBe('took');
  });
});
