import { describe, expect, it } from '@jest/globals';

import type { Card } from '@/features/deck/model';

import { askLine, asThis, deckMood, doneToday, inVoice, lineFor, localDay, NUDGE_LINES, nudgeKind, nudgeLevel, nudgeLevelSince, nudgeSeed } from './lines';
import { DEFAULT_RECIPE, MOOD_FACE, PARTS, randomRecipe, toOptions, validRecipe } from './recipe';

const DAY = 86_400_000;
const now = Date.parse('2026-11-07T12:00:00Z');
const ago = (days: number) => new Date(now - days * DAY).toISOString();
const card = (over: Partial<Card>): Card => ({
  id: '11111111-2222-3333-4444-555555555555', title: 'Renew the car insurance', bucket: 'Home', effort: '15 min', when: 'this week',
  detail: '', owner: 'me', status: 'active', traded: false, weight: 1, story: [], ...over,
});

describe('nudge level', () => {
  it('steps up at 3, 6 and 10 days', () => {
    expect(nudgeLevelSince(ago(2.9), now, 3)).toBe(0);
    expect(nudgeLevelSince(ago(3), now, 3)).toBe(1);
    expect(nudgeLevelSince(ago(5.9), now, 3)).toBe(1);
    expect(nudgeLevelSince(ago(6), now, 3)).toBe(2);
    expect(nudgeLevelSince(ago(10), now, 3)).toBe(3);
  });
  it('never goes past what the receiver allows', () => {
    expect(nudgeLevelSince(ago(12), now, 1)).toBe(1);
    expect(nudgeLevelSince(ago(12), now, 2)).toBe(2);
  });
  it('is nothing without a date', () => expect(nudgeLevelSince(undefined, now, 3)).toBe(0));
});

describe('which cards get nudged', () => {
  it('mine and together while active', () => {
    expect(nudgeKind(card({}))).toBe('mine');
    expect(nudgeKind(card({ owner: 'together' }))).toBe('mine');
  });
  it('Table cards nobody took', () => expect(nudgeKind(card({ owner: 'table', status: 'deal' }))).toBe('table'));
  it('not done, waiting, the partner\'s, requests or surprises', () => {
    expect(nudgeKind(card({ status: 'done' }))).toBeNull();
    expect(nudgeKind(card({ status: 'waiting' }))).toBeNull();
    expect(nudgeKind(card({ owner: 'partner' }))).toBeNull();
    expect(nudgeKind(card({ owner: 'table', status: 'deal', request: 'take' }))).toBeNull();
    expect(nudgeKind(card({ owner: 'table', status: 'deal', surprise: true }))).toBeNull();
  });
  it('done cards are never nudged however old', () => expect(nudgeLevel(card({ status: 'done', sortAt: ago(20) }), now, 3)).toBe(0));
});

describe('lines', () => {
  it('has six lines per kind and level, each with the task', () => {
    for (const kind of ['mine', 'table'] as const) for (const level of [1, 2, 3] as const) {
      expect(NUDGE_LINES[kind][level]).toHaveLength(6);
      for (const l of NUDGE_LINES[kind][level]) expect(l).toContain('%s');
    }
  });
  it('speaks in the chosen voice', () => {
    const l = '{Main dekh raha hoon|Main dekh rahi hoon|Hum dekh rahe hain} 👀';
    expect(inVoice(l, 'he')).toBe('Main dekh raha hoon 👀');
    expect(inVoice(l, 'she')).toBe('Main dekh rahi hoon 👀');
    expect(inVoice(l, 'neutral')).toBe('Hum dekh rahe hain 👀');
  });
  it('leaves no voice markers or empty gaps in any line', () => {
    for (const kind of ['mine', 'table'] as const) for (const level of [1, 2, 3] as const) for (const l of NUDGE_LINES[kind][level]) {
      for (const v of ['he', 'she', 'neutral'] as const) {
        const out = inVoice(l, v);
        expect(out).not.toMatch(/[{}|]/);
        expect(out).not.toMatch(/\s{2}/);
      }
    }
  });
  it('is the same line all day for a card, and fills in the title', () => {
    const c = card({ sortAt: ago(4) });
    expect(lineFor(c, 'mine', 1, 'she', now)).toBe(lineFor(c, 'mine', 1, 'she', now + 3_600_000));
    expect(lineFor(c, 'mine', 1, 'she', now)).toContain('Renew the car insurance');
  });
  it('seeds like the server: id character codes plus the day', () => {
    const id = card({}).id;
    let sum = 0;
    for (const ch of id) sum += ch.charCodeAt(0);
    expect(nudgeSeed(id, localDay(now))).toBe(sum + localDay(now));
  });
});

describe('recipes', () => {
  it('random recipes only use real parts', () => {
    for (let i = 0; i < 50; i++) {
      const r = randomRecipe();
      expect(PARTS.head).toContain(r.head);
      expect(PARTS.skin).toContain(r.skin);
      expect(PARTS.clothing).toContain(r.clothing);
      if (r.facialHair) expect(PARTS.facialHair).toContain(r.facialHair);
      if (r.accessories) expect(PARTS.accessories).toContain(r.accessories);
    }
  });
  it('repairs unknown parts', () => {
    expect(validRecipe({ head: 'nope', skin: 'zzz' })).toEqual({ ...DEFAULT_RECIPE });
    expect(validRecipe(null)).toBeNull();
  });
  it('wears the mood\'s face', () => {
    expect(toOptions(DEFAULT_RECIPE, 'firm').face).toEqual([MOOD_FACE.firm]);
    expect(toOptions(DEFAULT_RECIPE, 'calm').face).toEqual([MOOD_FACE.calm]);
  });
});

describe('lines beside the title', () => {
  it('say "this" instead of repeating the title', () => {
    expect(asThis('%s table pe akela baitha hai. Koi utha lo?')).toBe('Yeh table pe akela baitha hai. Koi utha lo?');
    expect(asThis('Tum dono %s ko dekh ke nikal jaate ho')).toBe('Tum dono isko dekh ke nikal jaate ho');
    expect(asThis('%s pe dhool jamne lagi hai.')).toBe('Is pe dhool jamne lagi hai.');
    expect(asThis('%s ne mujhse poocha')).toBe('Isne mujhse poocha');
  });
  it('every line reads without a placeholder left', () => {
    for (const kind of ['mine', 'table'] as const) for (const level of [1, 2, 3] as const) for (const l of NUDGE_LINES[kind][level]) {
      expect(asThis(inVoice(l, 'neutral'))).not.toContain('%s');
    }
  });
});

describe('surprises', () => {
  it('are never nudged', () => {
    const c = { id: 's', title: 's', owner: 'me', status: 'active', surprise: true } as Card;
    expect(nudgeKind(c)).toBeNull();
  });
});

describe('one mood for the deck', () => {
  it('takes the most ignored card', () => {
    const deck = [card({ id: 'a', title: 'Fix the tap', sortAt: ago(4) }), card({ id: 'b', title: 'Pay the rent', sortAt: ago(11) }), card({ id: 'c', sortAt: ago(1) })];
    const m = deckMood(deck, now, 3, 'she', 0);
    expect(m.mood).toBe('firm');
    expect(m.card?.id).toBe('b');
    expect(m.line).toContain('Pay the rent');
  });

  it('is calm with nothing waiting, and proud only on a day I finished something', () => {
    const fresh = [card({ sortAt: ago(1) })];
    expect(deckMood(fresh, now, 2, 'he', 0).mood).toBe('calm');
    const proud = deckMood(fresh, now, 2, 'he', 2);
    expect(proud.mood).toBe('proud');
    expect(proud.line).not.toContain('%d');
  });

  it('says the same thing all day', () => {
    expect(deckMood([], now, 2, 'he', 0).line).toBe(deckMood([], now + 3_600_000, 2, 'he', 0).line);
  });

  it('counts only my cards finished today', () => {
    const all = [card({ status: 'done', doneBy: 'me', doneAt: new Date(now).toISOString() }), card({ status: 'done', doneBy: 'partner', doneAt: new Date(now).toISOString() }), card({ status: 'done', doneBy: 'me', doneAt: ago(3) })];
    expect(doneToday(all, now)).toBe(1);
  });

  it('asks in the right voice', () => {
    for (const v of ['he', 'she', 'neutral'] as const) expect(askLine('give', 'x', v, now)).not.toMatch(/[{}|]/);
    expect(askLine('give', 'x', 'she', now)).toContain('leti');
  });
});
