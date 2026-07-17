// The contribution grid geometry, shared by the on-screen ContributionGraph and
// the server-rendered OG card so the two can't drift. Pure: it lays out one
// calendar year (Jan–Dec) of played days as Monday-first week columns, GitHub
// style. Colour/markup is the caller's job — this owns only the shape.

import { shiftDay } from "./day.ts";

export interface DayCount {
  date: string;
  count: number;
}

export interface GridCell {
  date: string;
  count: number;
  spacer: boolean; // a pad cell: outside the year, or a future day not yet played
}

/** Monday-first weekday index (0 = Monday … 6 = Sunday). */
function mondayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** The calendar years the account spans, current year first, back to the year it
 *  joined — the set of tabs the profile can switch between. */
export function availableYears(joinedAt: string, today: string): number[] {
  const from = Number(joinedAt.slice(0, 4));
  const to = Number(today.slice(0, 4));
  const years: number[] = [];
  for (let y = to; y >= from; y--) years.push(y);
  return years;
}

/** One calendar year as Monday-first week columns of 7 cells. Days outside the
 *  year (leading/trailing pad to whole weeks) and future days past `today` are
 *  spacers; every real day in the year carries its tiers-solved count (0 if the
 *  player didn't play that day). */
export function buildYear(
  days: DayCount[],
  year: number,
  today: string,
): GridCell[][] {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  const start = shiftDay(jan1, -mondayIndex(jan1)); // Monday on/before Jan 1

  const weeks: GridCell[][] = [];
  let col: GridCell[] = [];
  for (let d = start; d <= dec31; d = shiftDay(d, 1)) {
    const outside = d < jan1 || d > today; // before the year, or still in the future
    col.push({ date: d, count: counts.get(d) ?? 0, spacer: outside });
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
