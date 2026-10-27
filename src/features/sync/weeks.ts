export type SyncEntry = { member: string; week_start: string; appreciation: string };

/** Monday of the week containing `d`, as YYYY-MM-DD (matches Postgres date_trunc('week')). */
export function weekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

/** Weeks where both wrote an appreciation. Forgiving: a missed week pauses it, never resets it. */
export function weeksInSync(entries: SyncEntry[]): number {
  const byWeek = new Map<string, Set<string>>();
  for (const e of entries) byWeek.set(e.week_start, (byWeek.get(e.week_start) ?? new Set()).add(e.member));
  return [...byWeek.values()].filter((m) => m.size >= 2).length;
}
