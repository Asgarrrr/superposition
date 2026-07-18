// Server-only puzzle resolution for the daily mode: the stored row, the
// deterministic bank fallback, and the weekend épreuve. Kept OUT of daily.ts
// on purpose: daily.ts is imported by client components for its server
// functions, and a plain value export touching the db there drags the whole
// drizzle/pg graph into the client bundle ("Buffer is not defined" in the
// browser). This module must only ever be imported by server code.

import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyPuzzle } from "../db/schema.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import { Lru } from "../lib/lru.ts";
import type { Level } from "../engine/types.ts";

export interface DailyPuzzle {
  date: string;
  tier: number;
  level: Level;
  optimal: number;
}

// The weekend "épreuve d'artiste" — a 6×6 tier the cron writes only on Sat/Sun.
// Unlike 0–2 it has NO bank fallback (the bank is all 5×5), so it exists only
// when the generator wrote a row; a missing one is simply unavailable.
export const WEEKEND_TIER = 3;

// The tiered fallback fans the level bank across three difficulty bands (by
// solved length) so a cron-missed tier still gets a level of roughly the right
// difficulty. Computed once per process (solving the whole bank), then cached.
let bands: Level[][] | null = null;
function difficultyBands(): Level[][] {
  if (bands) return bands;
  const scored = LEVELS.map((lv) => ({
    lv,
    len: solve(lv)?.inputs.length ?? 0,
  }))
    .sort((a, b) => a.len - b.len)
    .map((s) => s.lv);
  const n = Math.ceil(scored.length / 3);
  bands = [scored.slice(0, n), scored.slice(n, 2 * n), scored.slice(2 * n)].map(
    // guard against an empty band on a tiny bank — never hand back []
    (band, i) =>
      band.length ? band : [scored[Math.min(i, scored.length - 1)]],
  );
  return bands;
}

// The fallback is fully determined by (date, tier), so solve() it at most once
// per key per server process instead of on every request to a cron-missed tier.
// Bounded: the public replay endpoint resolves fallbacks for arbitrary past
// (date, tier) pairs, so an unbounded Map would grow without limit.
const fallbackCache = new Lru<string, DailyPuzzle>(256);

/** Deterministic fallback: same (date, tier) → same level, everywhere, no DB row. */
function fallbackPuzzle(date: string, tier: number): DailyPuzzle {
  // the weekend tier has no bank fallback — its 6×6 monster exists only if the
  // cron generated it, so a missing one must never be papered over with a 5×5
  if (tier >= WEEKEND_TIER) throw new Error("weekend tier has no fallback");
  const key = `${date}:${tier}`;
  const cached = fallbackCache.get(key);
  if (cached) return cached;
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const band = difficultyBands()[tier];
  const base = band[((dayNumber % band.length) + band.length) % band.length];
  const level: Level = { ...base, id: `daily-${date}-t${tier}` };
  const puzzle: DailyPuzzle = {
    date,
    tier,
    level,
    optimal: solve(level)?.inputs.length ?? 0,
  };
  fallbackCache.set(key, puzzle);
  return puzzle;
}

/** The stored puzzle for a (date, tier), or null when the cron wrote none. */
export async function fetchRow(
  date: string,
  tier: number,
): Promise<DailyPuzzle | null> {
  const [row] = await db
    .select()
    .from(dailyPuzzle)
    .where(and(eq(dailyPuzzle.date, date), eq(dailyPuzzle.tier, tier)))
    .limit(1);
  return row
    ? { date: row.date, tier: row.tier, level: row.level, optimal: row.optimal }
    : null;
}

/** A campaign-band tier (0–2): the DB row, else the deterministic bank fallback,
 *  so /daily is always playable. NOT for the weekend tier (it has no fallback —
 *  use `puzzleFor`, which may resolve null). */
export async function resolveDaily(
  date: string,
  tier: number,
): Promise<DailyPuzzle> {
  return (await fetchRow(date, tier)) ?? fallbackPuzzle(date, tier);
}

/** The puzzle for a (date, tier), resolved exactly as play does — the stored
 *  row, or the deterministic bank fallback for the campaign tiers; the weekend
 *  épreuve only when the cron wrote one (else null). The single resolver behind
 *  score submission, the leaderboard's optimal, and the replay-GIF endpoint, so
 *  every path reconstructs the very board that was played, never one the client
 *  asserts. */
export function puzzleFor(
  date: string,
  tier: number,
): Promise<DailyPuzzle | null> {
  return tier === WEEKEND_TIER
    ? fetchRow(date, WEEKEND_TIER)
    : resolveDaily(date, tier);
}
