// Shared plumbing for the two score boards — the daily (scoped by date + tier)
// and the campaign (scoped by level). Both tables expose the same shape
// (userId, moves, undos, trace, createdAt); the only difference is the table
// and the scope predicate, so the board types, the session lookup, the ranked
// reads and the best-score upsert live here once instead of in both callers.
// The ranking rule itself is defined once in ranking.ts (pure, DB-free).

import { getRequest } from "@tanstack/react-start/server";
import { and, count, eq, type SQL } from "drizzle-orm";
import type { IndexColumn } from "drizzle-orm/pg-core";
import { db } from "../db/index.ts";
import { dailyScore, levelScore, user } from "../db/schema.ts";
import { auth } from "../lib/auth.ts";
import { beatenBy, rankingOrder, strictlyAhead } from "./ranking.ts";

type ScoreTable = typeof dailyScore | typeof levelScore;
type ScoreInsert =
  typeof dailyScore.$inferInsert | typeof levelScore.$inferInsert;

export interface LeaderRow {
  rank: number;
  userId: string;
  name: string;
  username: string | null; // links the row to /profile/$username (null: pre-plugin)
  moves: number;
  clean?: boolean; // solved with no undo/reset (a "clean pull"); both boards set it
}

export interface MyResult {
  moves: number;
  rank: number;
}

/** One board's worth of data, shared by the daily and the campaign. */
export interface BoardData {
  optimal: number;
  rows: LeaderRow[];
  mine: MyResult | null;
}

export async function currentUserId(): Promise<string | null> {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}

/** Top 50 rows under `scope`, ranked (moves, undos, createdAt) ascending. */
export async function boardRows(
  table: ScoreTable,
  scope: SQL,
): Promise<LeaderRow[]> {
  const rows = await db
    .select({
      userId: table.userId,
      name: user.name,
      username: user.username,
      moves: table.moves,
      undos: table.undos,
    })
    .from(table)
    .innerJoin(user, eq(table.userId, user.id))
    .where(scope)
    .orderBy(...rankingOrder(table))
    .limit(50);
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: r.name,
    username: r.username,
    moves: r.moves,
    clean: r.undos === 0,
  }));
}

/** A user's standing under boardRows' ordering: best moves and positional rank.
 *  Null when the user has no score under `scope`. */
export async function standing(
  table: ScoreTable,
  scope: SQL,
  userId: string,
): Promise<MyResult | null> {
  const [mine] = await db
    .select({
      moves: table.moves,
      undos: table.undos,
      createdAt: table.createdAt,
    })
    .from(table)
    .where(and(scope, eq(table.userId, userId)))
    .limit(1);
  if (!mine) return null;

  // count everyone who sorts strictly ahead under (moves, undos, createdAt)
  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(table)
    .where(and(scope, strictlyAhead(table, mine)));
  return { moves: mine.moves, rank: Number(ahead) + 1 };
}

/** Writes a validated result into its (scope, user) slot, keeping the better
 *  row per the ranking rule (fewer moves, then fewer corrections). `row`
 *  carries the table's scope columns (date + tier for the daily, levelId for
 *  the campaign) alongside the shared score fields; `target` is that table's
 *  unique slot. */
export async function upsertBestScore(
  table: ScoreTable,
  target: IndexColumn[],
  row: ScoreInsert & { undos: number },
): Promise<void> {
  await db
    .insert(table)
    .values(row)
    .onConflictDoUpdate({
      target,
      set: {
        moves: row.moves,
        undos: row.undos,
        trace: row.trace,
        createdAt: new Date(),
      },
      where: beatenBy(table, { moves: row.moves, corrections: row.undos }),
    });
}
