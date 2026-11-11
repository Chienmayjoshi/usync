import { describe, expect, it } from '@jest/globals';

import { TASK_TONES, toneFor } from './taskTone';

describe('toneFor', () => {
  it('uses the colour the task carries', () => {
    expect(toneFor({ id: 'x', color: 'sky' })).toBe('sky');
  });

  it('falls back to a stable pick of the seven by id', () => {
    const a = toneFor({ id: 'abc-123' });
    expect(toneFor({ id: 'abc-123', color: null })).toBe(a);
    expect(TASK_TONES).toContain(a);
    expect(toneFor({ id: 'y', color: 'cream' })).toBe(toneFor({ id: 'y' }));
  });

  it('spreads ids across the palette', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => toneFor({ id: `task-${i}` })));
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});
