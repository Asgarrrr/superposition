// Server functions for the daily puzzle (RPC, since SSR is off). The puzzle is
// written daily by the cron generator; with no row yet we fall back to a
// deterministic pick from the level bank so /daily is always playable.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyPuzzle, dailyScore } from "../db/schema.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import { auth } from "../lib/auth.ts";
import { utcDay } from "../lib/day.ts";
import { boardRows, standing } from "./leaderboard.ts";
import { validateTrace, validateTraceShape } from "./replay.ts";
import type { Level, TraceStep } from "../engine/types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A score is accepted for today, or yesterday as a grace window for a player
 *  who crosses UTC midnight mid-solve — never for an arbitrary day. */
function isSubmittableDay(date: string): boolean {
  return date === utcDay(0) || date === utcDay(-1);
}

export interface DailyPuzzle {
  date: string;
  level: Level;
  optimal: number;
}

// The fallback is fully determined by the date, so solve() it at most once per
// date per server process instead of on every request to a cron-missed day.
const fallbackCache = new Map<string, DailyPuzzle>();

/** Deterministic fallback: same date → same level, everywhere, with no DB row. */
function fallbackPuzzle(date: string): DailyPuzzle {
  const cached = fallbackCache.get(date);
  if (cached) return cached;
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const base =
    LEVELS[((dayNumber % LEVELS.length) + LEVELS.length) % LEVELS.length];
  const level: Level = { ...base, id: `daily-${date}` };
  const puzzle: DailyPuzzle = {
    date,
    level,
    optimal: solve(level)?.inputs.length ?? 0,
  };
  fallbackCache.set(date, puzzle);
  return puzzle;
}

/** A given day's puzzle: the DB row if the cron wrote it, else the fallback. */
async function resolveDaily(date: string): Promise<DailyPuzzle> {
  const [row] = await db
    .select()
    .from(dailyPuzzle)
    .where(eq(dailyPuzzle.date, date))
    .limit(1);
  if (row) return { date: row.date, level: row.level, optimal: row.optimal };
  return fallbackPuzzle(date);
}

async function currentUserId(): Promise<string | null> {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}

export const getDailyPuzzle = createServerFn({ method: "GET" }).handler(
  (): Promise<DailyPuzzle> => resolveDaily(utcDay()),
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
  .validator((data: unknown): { trace: TraceStep[]; date: string } => {
    const d = data as { trace?: unknown; date?: unknown } | null;
    const trace = validateTraceShape(d?.trace);
    if (typeof d?.date !== "string" || !DATE_RE.test(d.date))
      throw new Error("invalid date");
    return { trace, date: d.date };
  })
  .handler(async ({ data }): Promise<SubmitResult> => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Not authenticated");
    if (!isSubmittableDay(data.date)) throw new Error("Puzzle no longer open");

    const date = data.date;
    const puzzle = await resolveDaily(date);
    const result = validateTrace(puzzle.level, data.trace);
    if (!result.ok) throw new Error("Invalid solution");

    // Guarantee the puzzle row exists (fallback days have none) so the score FK
    // holds — this also pins the fallback as the day's official puzzle.
    await db
      .insert(dailyPuzzle)
      .values({ date, level: puzzle.level, optimal: puzzle.optimal })
      .onConflictDoNothing();

    // Keep the best result for this (date, user): fewer moves, or same moves
    // with fewer corrections.
    await db
      .insert(dailyScore)
      .values({
        date,
        userId,
        moves: result.moves,
        undos: result.corrections,
        trace: data.trace,
      })
      .onConflictDoUpdate({
        target: [dailyScore.date, dailyScore.userId],
        set: {
          moves: result.moves,
          undos: result.corrections,
          trace: data.trace,
          createdAt: new Date(),
        },
        where: sql`${dailyScore.moves} > ${result.moves} OR (${dailyScore.moves} = ${result.moves} AND ${dailyScore.undos} > ${result.corrections})`,
      });

    return { ok: true, moves: result.moves };
  });

export interface LeaderRow {
  rank: number;
  userId: string;
  name: string;
  moves: number;
  clean?: boolean; // solved with no undo/reset (a "clean pull"); both boards set it
}

export interface MyResult {
  moves: number;
  rank: number;
}

/** One board's worth of data, mirrored by the campaign (see campaign.ts). */
export interface BoardData {
  optimal: number;
  rows: LeaderRow[];
  mine: MyResult | null;
}

// optimal is fixed per date, so resolve the puzzle for it at most once per date
// per process instead of on every board read (which is a daily_puzzle SELECT, or
// the solver on a cron-missed day).
const optimalByDate = new Map<string, number>();
async function dailyOptimal(date: string): Promise<number> {
  const cached = optimalByDate.get(date);
  if (cached !== undefined) return cached;
  const { optimal } = await resolveDaily(date);
  optimalByDate.set(date, optimal);
  return optimal;
}

/** The board for a specific day (optimal, top 50, and — if signed in — the
 *  caller's own standing) in one round trip. The date is the day the client is
 *  playing (the loader's), NOT the server's current utcDay(): a solve that
 *  crosses UTC midnight must still read the board it submitted to. Public:
 *  reading needs no account; the caller's standing is queried only with a
 *  session. */
export const getDailyBoard = createServerFn({ method: "GET" })
  .validator((data: unknown): { date: string } => {
    const d = data as { date?: unknown } | null;
    if (typeof d?.date !== "string" || !DATE_RE.test(d.date))
      throw new Error("invalid date");
    return { date: d.date };
  })
  .handler(async ({ data }): Promise<BoardData> => {
    const { date } = data;
    const scope = eq(dailyScore.date, date);
    const userId = await currentUserId();
    const [optimal, rows, mine] = await Promise.all([
      dailyOptimal(date),
      boardRows(dailyScore, scope),
      userId ? standing(dailyScore, scope, userId) : Promise.resolve(null),
    ]);
    return { optimal, rows, mine };
  });
