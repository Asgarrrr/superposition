// Server functions for the campaign leaderboard: one board per level. Mirrors
// the daily layer, keyed by the code-side level id instead of a date. Trusts
// nothing the client claims about its score — the winning inputs are replayed
// through the pure engine (see replay.ts) before a row is written.

import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { levelScore } from "../db/schema.ts";
import { db } from "../db/index.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import {
  boardRows,
  currentUserId,
  requireUserId,
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
 * Stamps the "ever solved cleanly" fact onto a player's row for a level.
 *
 * A second statement rather than one more field on `upsertBestScore`, because
 * that upsert's `onConflictDoUpdate` is gated by `beatenBy(...)`: a "sans
 * retouche" run that does NOT beat the stored row writes nothing — precisely
 * the case this column exists to cover. Grafted onto the upsert, it would only
 * ever fill in where the seal was already recoverable.
 *
 * It lives here and not in leaderboard.ts because the column exists on
 * `level_score` alone; sharing it would mean a per-table guard (cf.
 * `elapsedColumn`) for a rule with exactly one caller.
 */
async function markEverClean(levelId: string, userId: string): Promise<void> {
  await db
    .update(levelScore)
    .set({ everClean: true })
    .where(and(eq(levelScore.levelId, levelId), eq(levelScore.userId, userId)));
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
    const userId = await requireUserId();

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

    // the row is guaranteed to exist after the upsert, so this always lands
    if (result.corrections === 0) await markEverClean(data.levelId, userId);

    return { ok: true, moves: result.moves };
  });

/** Every campaign score the current user holds, per level. Read-only, public
 *  shape: returns `[]` when not signed in (no throw). Feeds the client's
 *  login-time progress reconciliation (useProgressSync).
 *
 *  Two facts, two columns, and both are needed. `undos` is the correction count
 *  of the STORED BEST row — what the boards rank and seal on, and what
 *  `planUploads` breaks a tie of equal moves on. `everClean` is the progression
 *  fact: the level has been solved "sans retouche" at least once, true even
 *  when that run is not the row the server kept. It is the one the local ledger
 *  restores on a new device, where localStorage does not travel. */
export const getMyLevelScores = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    { levelId: string; moves: number; undos: number; everClean: boolean }[]
  > => {
    const userId = await currentUserId();
    if (!userId) return [];
    return db
      .select({
        levelId: levelScore.levelId,
        moves: levelScore.moves,
        undos: levelScore.undos,
        everClean: levelScore.everClean,
      })
      .from(levelScore)
      .where(eq(levelScore.userId, userId));
  },
);
