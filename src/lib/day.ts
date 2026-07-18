// The daily puzzle's primary-key format (YYYY-MM-DD, UTC), shared by the cron
// writer and the RPC reader so the two can't drift.

/** Is `date` a real UTC calendar day in YYYY-MM-DD form? A shape check alone
 *  (a bare `\d{4}-\d{2}-\d{2}` regex) waves through impossible dates like
 *  `2020-13-45` or `2024-02-31`, which then poison `Date.parse` downstream
 *  (NaN day-number → bogus level) and surface as a 500. Parse in UTC and
 *  require the round-trip back to the same string, so only true days pass. */
export function isValidDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === date;
}

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

/** May a daily replay for `date` be shown publicly? Only once its day has fully
 *  passed (UTC): rendering a still-live daily would spoil it. The one predicate
 *  behind both the server's 403 gate (render.ts) and the client's share-button
 *  guard, so the two can't drift. `today` defaults to the current UTC day. */
export function isReplayPublic(
  date: string,
  today: string = utcDay(),
): boolean {
  return date < today;
}

/** Is this UTC day (YYYY-MM-DD) a weekend — Saturday or Sunday? The weekend
 *  "épreuve d'artiste" tier is keyed on this, on the same UTC day the daily
 *  board already uses, so it's the same window for every player worldwide. */
export function isWeekend(date: string): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}
