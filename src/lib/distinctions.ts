// The four distinctions a profile can print, as a value with pure rules.
//
// A distinction is one family of merit at one tier — the philatelic reading:
// a family is a stamp SERIES, and its four tiers are the four face values of
// that series. The design never changes, only the ink and the figure do, so the
// page carries exactly four stamps forever however many tiers we add later.
//
// This module is the SOLE owner of what a family measures and where its
// thresholds sit. `Stamp.tsx` only draws what it is handed; `profileData.ts`
// only gathers the dates. Put no threshold in either.

import { shiftDay } from "./day.ts";

export type Family = "regularite" | "maitrise" | "rarete" | "edition";

/** The four families, in the order they are printed on the sheet. */
export const FAMILIES: readonly Family[] = [
  "regularite",
  "maitrise",
  "rarete",
  "edition",
] as const;

/** Each family's four face values. Ascending, always four. */
export const THRESHOLDS: Record<Family, readonly number[]> = {
  regularite: [7, 30, 100, 365],
  maitrise: [1, 10, 40, 120],
  rarete: [1, 5, 20, 52],
  edition: [1, 6, 14, 22],
};

/** Every date a family needs, as UTC days (YYYY-MM-DD). Order and duplicates
 *  are the caller's business — this module sorts and de-duplicates what it must. */
export interface DistinctionInput {
  /** Every day the player solved at least one tier. Feeds régularité. */
  days: string[];
  /** One entry per solve at the solver's optimum, daily and campaign alike. */
  bat: string[];
  /** One entry per weekend "épreuve d'artiste" (tier 3) solved. */
  artist: string[];
  /** One entry per campaign plate put on the record. */
  plates: string[];
}

export interface Distinction {
  readonly family: Family;
  /** What was measured: the longest run, or a count of qualifying events. */
  readonly count: number;
  /** 0 when nothing is earned — the empty album mount. Otherwise 1…4. */
  readonly tier: number;
  /** The face value this tier stands on. Null at tier 0. */
  readonly threshold: number | null;
  /** The day the current tier was crossed — the postmark. Null at tier 0. */
  readonly earnedOn: string | null;
  /** The next face value to reach, or null once the series is complete. */
  readonly next: number | null;
}

/** The longest run of consecutive days, and the earliest day on which a run
 *  first reached a given length. Both read the same walk, so they can't drift.
 *
 *  A run is measured only from its start (no played day immediately before it),
 *  which is what makes the walk O(days) rather than quadratic and independent of
 *  iteration order — the same shape `computeStreaks` uses. */
function runsOf(days: string[]): {
  longest: number;
  reachedOn(n: number): string | null;
} {
  const played = new Set(days);
  const starts: { from: string; length: number }[] = [];
  let longest = 0;

  for (const day of played) {
    if (played.has(shiftDay(day, -1))) continue;
    let length = 1;
    while (played.has(shiftDay(day, length))) length++;
    starts.push({ from: day, length });
    if (length > longest) longest = length;
  }

  return {
    longest,
    // the nth day of every run long enough to contain it; the earliest wins,
    // because a tier is crossed once and keeps the date of that crossing
    reachedOn(n) {
      let earliest: string | null = null;
      for (const { from, length } of starts) {
        if (length < n) continue;
        const on = shiftDay(from, n - 1);
        if (!earliest || on < earliest) earliest = on;
      }
      return earliest;
    },
  };
}

/** The highest tier `count` reaches: 0 when it clears nothing, else 1…4. */
function tierOf(count: number, thresholds: readonly number[]): number {
  let tier = 0;
  for (const t of thresholds) {
    if (count < t) break;
    tier++;
  }
  return tier;
}

function resolve(
  family: Family,
  count: number,
  postmark: (threshold: number) => string | null,
): Distinction {
  const thresholds = THRESHOLDS[family];
  const tier = tierOf(count, thresholds);
  const threshold = tier === 0 ? null : thresholds[tier - 1]!;
  return {
    family,
    count,
    tier,
    threshold,
    earnedOn: threshold === null ? null : postmark(threshold),
    next: thresholds[tier] ?? null,
  };
}

/** The four distinctions, always all four and always in `FAMILIES` order. A
 *  family the player has not opened yet comes back at tier 0 with `next` set —
 *  that is the empty album mount, not an absence. */
export function distinctions(input: DistinctionInput): Distinction[] {
  const runs = runsOf(input.days);

  // the counting families share one postmark rule: the date of the Nth
  // qualifying event, once the events are in the order they happened
  const nth = (dates: string[]) => {
    const sorted = [...dates].sort();
    return (threshold: number) => sorted[threshold - 1] ?? null;
  };

  return [
    resolve("regularite", runs.longest, (n) => runs.reachedOn(n)),
    resolve("maitrise", input.bat.length, nth(input.bat)),
    resolve("rarete", input.artist.length, nth(input.artist)),
    resolve("edition", input.plates.length, nth(input.plates)),
  ];
}
