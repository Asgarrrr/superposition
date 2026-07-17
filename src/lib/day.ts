// The daily puzzle's primary-key format (YYYY-MM-DD, UTC), shared by the cron
// writer and the RPC reader so the two can't drift.

export function utcDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** The UTC day `offset` days from `date` (YYYY-MM-DD) — pure calendar shift,
 *  independent of the wall clock, for walking a run of days. */
export function shiftDay(date: string, offset: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Is this UTC day (YYYY-MM-DD) a weekend — Saturday or Sunday? The weekend
 *  "épreuve d'artiste" tier is keyed on this, on the same UTC day the daily
 *  board already uses, so it's the same window for every player worldwide. */
export function isWeekend(date: string): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}
