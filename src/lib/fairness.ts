// Who gets dealt a new card. Load is a rolling 7 day sum of effort weights; shared cards count half
// for each. The lighter partner gets the card. A shared plan is offered to both. Never shown as numbers.

export type Who = 'a' | 'b';

export type LoadItem = { owner: Who | 'together' | 'table'; weight: number; at: number; done: boolean };

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function loads(items: LoadItem[], now = Date.now()) {
  const l = { a: 0, b: 0 };
  for (const it of items) {
    // Open work always counts; finished work counts for the week it was done in.
    if (it.done && now - it.at > WEEK) continue;
    if (it.owner === 'a' || it.owner === 'b') l[it.owner] += it.weight;
    else if (it.owner === 'together') { l.a += it.weight / 2; l.b += it.weight / 2; }
  }
  return l;
}

/** Pick an owner for a new card. Ties go to the person who did not drop it, so noticing is rewarded. */
export function dealTo(items: LoadItem[], dropper: Who, opts: { together?: boolean; now?: number } = {}): Who | 'together' {
  if (opts.together) return 'together';
  const l = loads(items, opts.now);
  if (l.a === l.b) return dropper === 'a' ? 'b' : 'a';
  return l.a < l.b ? 'a' : 'b';
}

/** Balance tilt in [-1, 1]; negative means `me` carries more. Drives the seesaw only. */
export function tilt(items: LoadItem[], me: Who, now = Date.now()) {
  const l = loads(items, now);
  const total = l.a + l.b;
  if (!total) return 0;
  const mine = l[me];
  const theirs = me === 'a' ? l.b : l.a;
  return Math.max(-1, Math.min(1, (theirs - mine) / total));
}
