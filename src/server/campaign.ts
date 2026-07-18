// Server functions for the campaign leaderboard: one board per level. Mirrors
// the daily layer, keyed by the code-side level id instead of a date. Trusts
// nothing the client claims about its score — the winning inputs are replayed
// through the pure engine (see replay.ts) before a row is written.

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { levelScore } from "../db/schema.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import {
  boardRows,
  currentUserId,
  standing,
  upsertBestScore,
} from "./leaderboard.ts";
import { validateTrace, validateTraceShape } from "./replay.ts";
import type { BoardData } from "./leaderboard.ts";
import type { Level, TraceStep } from "../engine/types.ts";

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

function validateLevelId(data: unknown): { levelId: string } {
  const id = (data as { levelId?: unknown } | null)?.levelId;
  if (typeof id !== "string" || !BY_ID.has(id))
    throw new Error("invalid levelId");
  return { levelId: id };
}

/** A level's leaderboard (top 50, fewest moves first, then fewest corrections,
 *  then earliest submission), the solver's optimal, and — if signed in — the
 *  caller's own standing. Public: reading the board needs no account. */
export const getLevelBoard = createServerFn({ method: "GET" })
  .validator(validateLevelId)
  .handler(async ({ data }): Promise<BoardData> => {
    const { levelId } = data;
    const level = BY_ID.get(levelId)!;
    const scope = eq(levelScore.levelId, levelId);

    // the board and the caller's own standing are independent — fetch both in
    // one round trip rather than serializing mine behind rows
    const userId = await currentUserId();
    const [rows, mine] = await Promise.all([
      boardRows(levelScore, scope),
      userId ? standing(levelScore, scope, userId) : Promise.resolve(null),
    ]);

    return { optimal: levelOptimal(level), rows, mine };
  });

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

    // keep the better result for this (level, user) per the shared rule
    await upsertBestScore(levelScore, [levelScore.levelId, levelScore.userId], {
      levelId: data.levelId,
      userId,
      moves: result.moves,
      undos: result.corrections,
      trace: data.trace,
    });

    return { ok: true, moves: result.moves };
  });
