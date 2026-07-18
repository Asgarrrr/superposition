// Server functions for the daily puzzle (RPC, since SSR is off). The puzzle is
// written daily by the cron generator; with no row yet we fall back to a
// deterministic pick from the level bank so /daily is always playable.

import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyPuzzle, dailyScore } from "../db/schema.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import { isWeekend, utcDay } from "../lib/day.ts";
import {
  boardRows,
  currentUserId,
  standing,
  upsertBestScore,
} from "./leaderboard.ts";
import { validateTrace, validateTraceShape } from "./replay.ts";
import type { BoardData } from "./leaderboard.ts";
import type { Level, TraceStep } from "../engine/types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIERS = [0, 1, 2, 3] as const;

// The weekend "épreuve d'artiste" — a 6×6 tier the cron writes only on Sat/Sun.
// Unlike 0–2 it has NO bank fallback (the bank is all 5×5), so it exists only
// when the generator wrote a row; a missing one is simply unavailable.
const WEEKEND_TIER = 3;

/** A tier index (0 easy · 1 medium · 2 hard · 3 weekend épreuve), or throws. */
function asTier(v: unknown): number {
  if (typeof v === "number" && TIERS.includes(v as (typeof TIERS)[number]))
    return v;
  throw new Error("invalid tier");
}

/** A score is accepted for today, or yesterday as a grace window for a player
 *  who crosses UTC midnight mid-solve — never for an arbitrary day. */
function isSubmittableDay(date: string): boolean {
  return date === utcDay(0) || date === utcDay(-1);
}

export interface DailyPuzzle {
  date: string;
  tier: number;
  level: Level;
  optimal: number;
}

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
const fallbackCache = new Map<string, DailyPuzzle>();

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
async function fetchRow(
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
 *  use `weekendRow`, which may be null). */
async function resolveDaily(date: string, tier: number): Promise<DailyPuzzle> {
  return (await fetchRow(date, tier)) ?? fallbackPuzzle(date, tier);
}

/** The weekend épreuve for a date: the DB row only, or null when the cron never
 *  certified one. Never a 5×5 stand-in — callers degrade gracefully on null. */
async function weekendRow(date: string): Promise<DailyPuzzle | null> {
  return fetchRow(date, WEEKEND_TIER);
}

export const getDailyPuzzle = createServerFn({ method: "GET" })
  .validator((data: unknown): { tier: number } => {
    const d = data as { tier?: unknown } | null;
    const tier = asTier(d?.tier);
    // the weekend tier has no bank fallback; it's served only by getWeekendDaily,
    // so reject it here rather than letting resolveDaily hit the fallback throw
    if (tier === WEEKEND_TIER) throw new Error("invalid tier");
    return { tier };
  })
  .handler(({ data }): Promise<DailyPuzzle> =>
    resolveDaily(utcDay(), data.tier),
  );

/** Today's weekend épreuve d'artiste, or null when it's a weekday or the cron
 *  never wrote one. Never falls back to a bank level — the route redirects on
 *  null rather than serving a stand-in. */
export const getWeekendDaily = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyPuzzle | null> => {
    const date = utcDay();
    if (!isWeekend(date)) return null;
    return fetchRow(date, WEEKEND_TIER);
  },
);

export interface SubmitResult {
  ok: boolean;
  moves: number;
}

/**
 * Records a player's daily score. Trusts nothing: the client says which day it
 * played, the server re-resolves that day's puzzle (deterministically, never
 * from the client) and replays the full trace through the pure engine, deriving
 * both the winning move count and the correction count itself. The best result
 * per user wins the (date, user) slot: fewest moves, then fewest corrections.
 */
export const submitDailyScore = createServerFn({ method: "POST" })
  .validator(
    (data: unknown): { trace: TraceStep[]; date: string; tier: number } => {
      const d = data as {
        trace?: unknown;
        date?: unknown;
        tier?: unknown;
      } | null;
      const trace = validateTraceShape(d?.trace);
      if (typeof d?.date !== "string" || !DATE_RE.test(d.date))
        throw new Error("invalid date");
      return { trace, date: d.date, tier: asTier(d?.tier) };
    },
  )
  .handler(async ({ data }): Promise<SubmitResult> => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Not authenticated");
    if (!isSubmittableDay(data.date)) throw new Error("Puzzle no longer open");

    const { date, tier } = data;
    const puzzle =
      tier === WEEKEND_TIER
        ? await weekendRow(date)
        : await resolveDaily(date, tier);
    if (!puzzle) throw new Error("Puzzle not available");
    const result = validateTrace(puzzle.level, data.trace);
    if (!result.ok) throw new Error("Invalid solution");

    // Guarantee the puzzle row exists (fallback tiers have none) so the score FK
    // holds — this also pins the fallback as this tier's official puzzle.
    await db
      .insert(dailyPuzzle)
      .values({ date, tier, level: puzzle.level, optimal: puzzle.optimal })
      .onConflictDoNothing();

    // Keep the best result for this (date, tier, user) per the shared rule.
    await upsertBestScore(
      dailyScore,
      [dailyScore.date, dailyScore.tier, dailyScore.userId],
      {
        date,
        tier,
        userId,
        moves: result.moves,
        undos: result.corrections,
        trace: data.trace,
      },
    );

    return { ok: true, moves: result.moves };
  });

// optimal is fixed per (date, tier), so resolve the puzzle for it at most once
// per key per process instead of on every board read (which is a daily_puzzle
// SELECT, or the solver on a cron-missed tier).
const optimalByKey = new Map<string, number>();
async function dailyOptimal(date: string, tier: number): Promise<number> {
  const key = `${date}:${tier}`;
  const cached = optimalByKey.get(key);
  if (cached !== undefined) return cached;
  const puzzle =
    tier === WEEKEND_TIER
      ? await weekendRow(date)
      : await resolveDaily(date, tier);
  // an absent weekend épreuve reads as an empty board (optimal 0); don't cache
  // the miss, so it picks up the row once the cron writes it
  if (!puzzle) return 0;
  optimalByKey.set(key, puzzle.optimal);
  return puzzle.optimal;
}

/** The board for a specific day (optimal, top 50, and — if signed in — the
 *  caller's own standing) in one round trip. The date is the day the client is
 *  playing (the loader's), NOT the server's current utcDay(): a solve that
 *  crosses UTC midnight must still read the board it submitted to. Public:
 *  reading needs no account; the caller's standing is queried only with a
 *  session. */
export const getDailyBoard = createServerFn({ method: "GET" })
  .validator((data: unknown): { date: string; tier: number } => {
    const d = data as { date?: unknown; tier?: unknown } | null;
    if (typeof d?.date !== "string" || !DATE_RE.test(d.date))
      throw new Error("invalid date");
    return { date: d.date, tier: asTier(d?.tier) };
  })
  .handler(async ({ data }): Promise<BoardData> => {
    const { date, tier } = data;
    const scope = and(eq(dailyScore.date, date), eq(dailyScore.tier, tier))!;
    const userId = await currentUserId();
    const [optimal, rows, mine] = await Promise.all([
      dailyOptimal(date, tier),
      boardRows(dailyScore, scope),
      userId ? standing(dailyScore, scope, userId) : Promise.resolve(null),
    ]);
    return { optimal, rows, mine };
  });
