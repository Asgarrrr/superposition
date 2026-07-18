// Server functions for the daily puzzle (RPC, since SSR is off). The puzzle is
// written daily by the cron generator; with no row yet we fall back to a
// deterministic pick from the level bank so /daily is always playable.

import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyPuzzle, dailyScore } from "../db/schema.ts";
import { isValidDay, isWeekend, utcDay } from "../lib/day.ts";
import { computeStreaks } from "../lib/streak.ts";
import { Lru } from "../lib/lru.ts";
import {
  boardRows,
  currentUserId,
  standing,
  upsertBestScore,
} from "./leaderboard.ts";
import { validateTrace, validateTraceShape } from "./replay.ts";
import {
  WEEKEND_TIER,
  fetchRow,
  puzzleFor,
  resolveDaily,
  type DailyPuzzle,
} from "./dailyPuzzle.ts";
import type { BoardData } from "./leaderboard.ts";
import type { TraceStep } from "../engine/types.ts";

// The resolution internals (fallback bands, weekend row, puzzleFor) live in
// dailyPuzzle.ts, NOT here: this module is imported by client components for
// its server functions, and a plain value export touching the db would drag
// drizzle/pg into the client bundle. Only server functions and types may be
// exported from this file.
export type { DailyPuzzle } from "./dailyPuzzle.ts";

const TIERS = [0, 1, 2, 3] as const;

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
      if (typeof d?.date !== "string" || !isValidDay(d.date))
        throw new Error("invalid date");
      return { trace, date: d.date, tier: asTier(d?.tier) };
    },
  )
  .handler(async ({ data }): Promise<SubmitResult> => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Not authenticated");
    if (!isSubmittableDay(data.date)) throw new Error("Puzzle no longer open");

    const { date, tier } = data;
    const puzzle = await puzzleFor(date, tier);
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
// SELECT, or the solver on a cron-missed tier). Bounded for the same reason as
// fallbackCache: distinct past (date, tier) reads must not grow memory forever.
const optimalByKey = new Lru<string, number>(256);
async function dailyOptimal(date: string, tier: number): Promise<number> {
  const key = `${date}:${tier}`;
  const cached = optimalByKey.get(key);
  if (cached !== undefined) return cached;
  const puzzle = await puzzleFor(date, tier);
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
    if (typeof d?.date !== "string" || !isValidDay(d.date))
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

/** The signed-in player's current daily streak (consecutive UTC days with at
 *  least one tier solved), for the discreet reminder on the daily win screen.
 *  Zero when signed out — the reminder simply doesn't show.
 *
 *  The client passes the date of the puzzle it just solved (`solved`), and only
 *  that date is optimistically unioned into the played set, so the reminder is
 *  right even when this read races the rail's score upsert. We deliberately do
 *  NOT union the server's current utcDay(): during the grace window a player
 *  can solve *yesterday's* puzzle after UTC midnight, and unioning "today"
 *  would credit a day never played — inflating the streak by one. computeStreaks
 *  already grants a yesterday grace anchor, so no server-side "today" is needed.
 *  This union is optimistic: it credits the locally-solved day even if the score
 *  submit later fails; a transient failure resolves on the next solve/retry. */
export const getMyStreak = createServerFn({ method: "GET" })
  .validator((data: unknown): { solved: string | null } => {
    const d = data as { solved?: unknown } | null;
    if (d?.solved === undefined || d?.solved === null) return { solved: null };
    // accept only a submittable day (today or yesterday) — never an arbitrary
    // date the client could inject to fabricate a run
    if (typeof d.solved !== "string" || !isSubmittableDay(d.solved))
      throw new Error("invalid date");
    return { solved: d.solved };
  })
  .handler(async ({ data }): Promise<{ current: number }> => {
    const userId = await currentUserId();
    if (!userId) return { current: 0 };
    const rows = await db
      // distinct days played — the same set profileData.historyFor derives (there
      // with a per-day count); kept separate as this path needs only the dates
      .select({ date: dailyScore.date })
      .from(dailyScore)
      .where(eq(dailyScore.userId, userId))
      .groupBy(dailyScore.date);
    const days = rows.map((r) => r.date);
    if (data.solved) days.push(data.solved);
    return { current: computeStreaks(days, utcDay()).current };
  });
