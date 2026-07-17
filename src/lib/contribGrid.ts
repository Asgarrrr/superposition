// The contribution grid geometry, shared by the on-screen ContributionGraph and
// the server-rendered OG card so the two can't drift. Pure: it takes the played
// days, the account's first day and today, and lays them out as Monday-first
// week columns. Colour/markup is the caller's job — this owns only the shape.

import { shiftDay } from "./day.ts";

export interface DayCount {
  date: string;
  count: number;
}

export interface GridCell {
  date: string;
  count: number;
  spacer: boolean; // a leading/trailing pad cell (before the span, or past today)
}

// the grid always spans at least this many weeks, so a young or quiet account
// still reads as a full sheet rather than a lonely strip of cells
export const MIN_WEEKS = 18;

/** Monday-first weekday index (0 = Monday … 6 = Sunday). */
function mondayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** The earlier of two YYYY-MM-DD days (lexicographic order is chronological). */
function earlier(a: string, b: string): string {
  return a < b ? a : b;
}

/** Week columns of 7 cells each, from the earliest of {the minimum window, the
 *  account's first day, its first solved day} through today — so no counted day
 *  ever falls off-grid. */
export function buildWeeks(
  days: DayCount[],
  joinedAt: string,
  today: string,
): GridCell[][] {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const window = shiftDay(today, -(MIN_WEEKS * 7 - 1));
  let origin = earlier(joinedAt, window);
  if (days[0]) origin = earlier(origin, days[0].date); // days is ascending
  const start = shiftDay(origin, -mondayIndex(origin));

  const weeks: GridCell[][] = [];
  let col: GridCell[] = [];
  for (let d = start; d <= today; d = shiftDay(d, 1)) {
    col.push({ date: d, count: counts.get(d) ?? 0, spacer: d < origin });
    if (col.length === 7) {
      weeks.push(col);
      col = [];
    }
  }
  if (col.length) {
    while (col.length < 7) col.push({ date: "", count: 0, spacer: true });
    weeks.push(col);
  }
  return weeks;
}
