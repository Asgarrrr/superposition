// Server functions for the daily puzzle (RPC, since SSR is off). The puzzle is
// written daily by the cron generator; with no row yet we fall back to a
// deterministic pick from the level bank so /daily is always playable.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, asc, count, eq, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyPuzzle, dailyScore, user } from "../db/schema.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import { auth } from "../lib/auth.ts";
import { utcDay } from "../lib/day.ts";
import { validateInputsShape, validateSolution } from "./replay.ts";
import type { Input, Level } from "../engine/types.ts";

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
 * from the client) and replays the winning inputs through the pure engine.
 * Only a clean win is stored — best move count wins the (date, user) slot.
 */
export const submitDailyScore = createServerFn({ method: "POST" })
  .validator((data: unknown): { inputs: Input[]; date: string } => {
    const d = data as { inputs?: unknown; date?: unknown } | null;
    const inputs = validateInputsShape(d?.inputs);
    if (typeof d?.date !== "string" || !DATE_RE.test(d.date))
      throw new Error("invalid date");
    return { inputs, date: d.date };
  })
  .handler(async ({ data }): Promise<SubmitResult> => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Not authenticated");
    if (!isSubmittableDay(data.date)) throw new Error("Puzzle no longer open");

    const date = data.date;
    const puzzle = await resolveDaily(date);
    const result = validateSolution(puzzle.level, data.inputs);
    if (!result.ok) throw new Error("Invalid solution");

    // Guarantee the puzzle row exists (fallback days have none) so the score FK
    // holds — this also pins the fallback as the day's official puzzle.
    await db
      .insert(dailyPuzzle)
      .values({ date, level: puzzle.level, optimal: puzzle.optimal })
      .onConflictDoNothing();

    // Keep the best (lowest) move count for this (date, user).
    await db
      .insert(dailyScore)
      .values({ date, userId, moves: result.moves, inputs: data.inputs })
      .onConflictDoUpdate({
        target: [dailyScore.date, dailyScore.userId],
        set: {
          moves: result.moves,
          inputs: data.inputs,
          createdAt: new Date(),
        },
        where: sql`${dailyScore.moves} > ${result.moves}`,
      });

    return { ok: true, moves: result.moves };
  });

export interface LeaderRow {
  rank: number;
  userId: string;
  name: string;
  moves: number;
  clean?: boolean; // campaign only: solved with no undo/reset (a "clean pull")
}

export const getDailyLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaderRow[]> => {
    const date = utcDay();
    const rows = await db
      .select({
        userId: dailyScore.userId,
        name: user.name,
        moves: dailyScore.moves,
      })
      .from(dailyScore)
      .innerJoin(user, eq(dailyScore.userId, user.id))
      .where(eq(dailyScore.date, date))
      .orderBy(asc(dailyScore.moves), asc(dailyScore.createdAt))
      .limit(50);
    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.name,
      moves: r.moves,
    }));
  },
);

export interface MyResult {
  moves: number;
  rank: number;
}

export const getMyDailyResult = createServerFn({ method: "GET" }).handler(
  async (): Promise<MyResult | null> => {
    const userId = await currentUserId();
    if (!userId) return null;

    const date = utcDay();
    const [mine] = await db
      .select({ moves: dailyScore.moves, createdAt: dailyScore.createdAt })
      .from(dailyScore)
      .where(and(eq(dailyScore.date, date), eq(dailyScore.userId, userId)))
      .limit(1);
    if (!mine) return null;

    // Positional rank, matching getDailyLeaderboard's (moves asc, createdAt asc)
    // order: count everyone who sorts strictly ahead, plus one.
    const [{ ahead }] = await db
      .select({ ahead: count() })
      .from(dailyScore)
      .where(
        and(
          eq(dailyScore.date, date),
          or(
            lt(dailyScore.moves, mine.moves),
            and(
              eq(dailyScore.moves, mine.moves),
              lt(dailyScore.createdAt, mine.createdAt),
            ),
          ),
        ),
      );
    return { moves: mine.moves, rank: Number(ahead) + 1 };
  },
);
