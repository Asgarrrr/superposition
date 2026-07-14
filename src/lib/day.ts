// The daily puzzle's primary-key format (YYYY-MM-DD, UTC), shared by the cron
// writer and the RPC reader so the two can't drift.

export function utcDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
