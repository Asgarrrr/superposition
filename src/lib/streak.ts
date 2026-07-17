// Profile stats derived from the set of UTC days a player has completed at least
// one daily tier on. Pure: the caller passes today (utcDay()) so the "current"
// run is deterministic and testable, never reading the wall clock here.

import { shiftDay } from "./day.ts";

export interface Streaks {
  total: number; // distinct days played
  current: number; // consecutive days ending today (or yesterday, grace window)
  longest: number; // longest consecutive run ever
}

export function computeStreaks(days: string[], today: string): Streaks {
  const played = new Set(days);

  let longest = 0;
  for (const day of played) {
    // count a run only from its start (no played day immediately before it), so
    // each run is measured once regardless of iteration order
    if (played.has(shiftDay(day, -1))) continue;
    let run = 1;
    while (played.has(shiftDay(day, run))) run++;
    if (run > longest) longest = run;
  }

  // the current run ends at today, or yesterday as a grace window so the streak
  // doesn't read as broken during the day before the player has solved it
  let anchor = played.has(today)
    ? today
    : played.has(shiftDay(today, -1))
      ? shiftDay(today, -1)
      : null;
  let current = 0;
  while (anchor && played.has(anchor)) {
    current++;
    anchor = shiftDay(anchor, -1);
  }

  return { total: played.size, current, longest };
}
