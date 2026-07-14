// Server functions for the campaign leaderboard: one board per level. Mirrors
// the daily layer, keyed by the code-side level id instead of a date. Trusts
// nothing the client claims about its score — the winning inputs are replayed
// through the pure engine (see replay.ts) before a row is written.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, asc, count, eq, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { levelScore, user } from "../db/schema.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import { auth } from "../lib/auth.ts";
import { validateTrace, validateTraceShape } from "./replay.ts";
import type { Level, TraceStep } from "../engine/types.ts";
import type { LeaderRow, MyResult } from "./daily.ts";

// Campaign levels are static and live in code, so index them once and cache the
// solver's optimal per level (BFS is not free) for the lifetime of the process.
const BY_ID = new Map<string, Level>(LEVELS.map((lv) => [lv.id, lv]));
const optimalCache = new Map<string, number>();

function levelOptimal(level: Level): number {
  const cached = optimalCache.get(level.id);
  if (cached !== undefined) return cached;
  const n = solve(level)?.inputs.length ?? 0;
  optimalCache.set(level.id, n);
  return n;
}

async function currentUserId(): Promise<string | null> {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}

function validateLevelId(data: unknown): { levelId: string } {
  const id = (data as { levelId?: unknown } | null)?.levelId;
  if (typeof id !== "string" || !BY_ID.has(id))
    throw new Error("invalid levelId");
  return { levelId: id };
}

export interface LevelBoard {
  optimal: number;
  rows: LeaderRow[];
  mine: MyResult | null;
}

/** A level's leaderboard (top 50, fewest moves first, then fewest corrections,
 *  then earliest submission), the solver's optimal, and — if signed in — the
 *  caller's own standing. Public: reading the board needs no account. */
export const getLevelBoard = createServerFn({ method: "GET" })
  .validator(validateLevelId)
  .handler(async ({ data }): Promise<LevelBoard> => {
    const { levelId } = data;
    const level = BY_ID.get(levelId)!;

    // the board and the caller's own standing are independent — fetch both in
    // one round trip rather than serializing mine behind rows
    const [rows, mine] = await Promise.all([
      db
        .select({
          userId: levelScore.userId,
          name: user.name,
          moves: levelScore.moves,
          undos: levelScore.undos,
        })
        .from(levelScore)
        .innerJoin(user, eq(levelScore.userId, user.id))
        .where(eq(levelScore.levelId, levelId))
        .orderBy(
          asc(levelScore.moves),
          asc(levelScore.undos),
          asc(levelScore.createdAt),
        )
        .limit(50),
      myResult(levelId),
    ]);

    return {
      optimal: levelOptimal(level),
      rows: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        name: r.name,
        moves: r.moves,
        clean: r.undos === 0,
      })),
      mine,
    };
  });

/** The caller's standing on a level: best moves and positional rank, matching
 *  getLevelBoard's ordering. Null when signed out or with no score yet. */
async function myResult(levelId: string): Promise<MyResult | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const [mine] = await db
    .select({
      moves: levelScore.moves,
      undos: levelScore.undos,
      createdAt: levelScore.createdAt,
    })
    .from(levelScore)
    .where(and(eq(levelScore.levelId, levelId), eq(levelScore.userId, userId)))
    .limit(1);
  if (!mine) return null;

  // count everyone who sorts strictly ahead under (moves, undos, createdAt)
  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(levelScore)
    .where(
      and(
        eq(levelScore.levelId, levelId),
        or(
          lt(levelScore.moves, mine.moves),
          and(
            eq(levelScore.moves, mine.moves),
            lt(levelScore.undos, mine.undos),
          ),
          and(
            eq(levelScore.moves, mine.moves),
            eq(levelScore.undos, mine.undos),
            lt(levelScore.createdAt, mine.createdAt),
          ),
        ),
      ),
    );
  return { moves: mine.moves, rank: Number(ahead) + 1 };
}

export interface SubmitResult {
  ok: boolean;
  moves: number;
}

/**
 * Records a player's best result for a campaign level. The server re-resolves
 * the level from the code bank (never from the client) and replays the full
 * trace, deriving both the winning move count and the correction count itself.
 * The best result per user wins the slot: fewest moves, then fewest corrections.
 */
export const submitLevelScore = createServerFn({ method: "POST" })
  .validator((data: unknown): { levelId: string; trace: TraceStep[] } => {
    const { levelId } = validateLevelId(data);
    const trace = validateTraceShape((data as { trace?: unknown }).trace);
    return { levelId, trace };
  })
  .handler(async ({ data }): Promise<SubmitResult> => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Not authenticated");

    const level = BY_ID.get(data.levelId)!;
    const result = validateTrace(level, data.trace);
    if (!result.ok) throw new Error("Invalid solution");

    await db
      .insert(levelScore)
      .values({
        levelId: data.levelId,
        userId,
        moves: result.moves,
        undos: result.corrections,
        trace: data.trace,
      })
      .onConflictDoUpdate({
        target: [levelScore.levelId, levelScore.userId],
        set: {
          moves: result.moves,
          undos: result.corrections,
          trace: data.trace,
          createdAt: new Date(),
        },
        // keep the better result: fewer moves, or same moves with fewer undos
        where: sql`${levelScore.moves} > ${result.moves} OR (${levelScore.moves} = ${result.moves} AND ${levelScore.undos} > ${result.corrections})`,
      });

    return { ok: true, moves: result.moves };
  });
