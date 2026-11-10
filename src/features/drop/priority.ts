import { whenOf } from '@/lib/sorter';

// The add-task sheet's priority (Figma 267:24679): four stops on a knob slider. For a surprise
// the same stops say when it gets revealed. Each stop stands for a date (due_on) and a word the
// card shows (when_text), which the Table's This week / Later filters already read.

export type Step = 'today' | 'days2' | 'week' | 'later';

export const STEPS: { key: Step; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'days2', label: '2 Days' },
  { key: 'week', label: 'This Week' },
  { key: 'later', label: 'Later' },
];

const DAY = 86_400_000;

/** The step the typed words point at, or null when they name no time at all. */
export function stepFromText(raw: string): Step | null {
  const when = whenOf(raw);
  // The sorter falls back to "this week" when it finds nothing; that is not the user saying so.
  if (when === 'this week' && !/\b(this week|is hafte|is week)\b/i.test(raw)) return null;
  return stepOfWhen(when);
}

function stepOfWhen(when: string): Step {
  if (when === 'today') return 'today';
  if (when === 'tomorrow' || when === 'day after tomorrow') return 'days2';
  if (/\b(next week|next month|this month|later|someday)\b/.test(when)) return 'later';
  return 'week';
}

/** What the card says: the sorter's own words ("by Friday") when they agree with the step. */
export function whenFor(step: Step, raw: string): string {
  const said = whenOf(raw);
  if (stepFromText(raw) === step) return said;
  return { today: 'today', days2: 'in 2 days', week: 'this week', later: 'later' }[step];
}

/** A local calendar day as YYYY-MM-DD. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The date a step stands for, from `now`: today, in two days, the coming Sunday, two weeks out. */
export function dueFor(step: Step, now: number): string {
  const d = new Date(now);
  const plus = step === 'today' ? 0 : step === 'days2' ? 2 : step === 'week' ? (7 - d.getDay()) % 7 : 14;
  return isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + plus));
}

/** A YYYY-MM-DD as a local midnight. */
const dayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * When a surprise gets revealed. An untouched surprise whose day has passed rolls on to today,
 * so the date never lies in the past.
 */
export function revealOn(dueOn: string | null | undefined, now: number): Date {
  const n = new Date(now);
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (!dueOn) return today;
  const due = dayOf(dueOn);
  return due < today ? today : due;
}

/** "Reveal today", "Reveal tomorrow", "Reveal by Fri" or "Reveal by 24 Nov". */
export function revealLabel(dueOn: string | null | undefined, now: number): string {
  const n = new Date(now);
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const on = revealOn(dueOn, now);
  const days = Math.round((on.getTime() - today.getTime()) / DAY);
  if (days <= 0) return 'Reveal today';
  if (days === 1) return 'Reveal tomorrow';
  if (days < 7) return `Reveal by ${on.toLocaleDateString('en-IN', { weekday: 'short' })}`;
  return `Reveal by ${on.getDate()} ${on.toLocaleDateString('en-IN', { month: 'short' })}`;
}

/** The reveal a day later than it is now (as postpone_surprise does on the server). */
export function postponed(dueOn: string | null | undefined, now: number, days = 1): string {
  const on = revealOn(dueOn, now);
  return isoDay(new Date(on.getFullYear(), on.getMonth(), on.getDate() + days));
}
