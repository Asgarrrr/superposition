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
import {
  beatenBy,
  liveCriteria,
  rankingOrder,
  strictlyAhead,
} from "./ranking.ts";

type ScoreTable = typeof dailyScore | typeof levelScore;
type ScoreInsert =
  typeof dailyScore.$inferInsert | typeof levelScore.$inferInsert;

/** The daily carries a discovery-time column, the campaign does not — so the
 *  ranked criteria are a property of the table, read here once. `in` narrows the
 *  union, which is what keeps every consumer below honest: there is no cast, so
 *  a table without the column cannot silently be treated as if it had one. */
function elapsedColumn(table: ScoreTable) {
  return "elapsedMs" in table ? table.elapsedMs : undefined;
}

export interface LeaderRow {
  rank: number;
  userId: string;
  name: string;
  username: string | null; // links the row to /profile/$username (null: pre-plugin)
  moves: number;
  clean?: boolean; // won in one clean pass (no undo since the last reset); both boards set it
  elapsedMs?: number | null; // daily only; null = not measured
}

export interface MyResult {
  moves: number;
  rank: number;
  clean: boolean; // own solve reached the win with no undo — shown in the footer
  elapsedMs?: number | null; // daily only; null = not measured
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

/** The caller, or a throw. Every server function that WRITES a score gates on
 *  this: an exported server function is a public endpoint, so the check has to
 *  live inside the handler rather than anywhere around it. Named here so a new
 *  write path can't quietly ship without one — the read paths deliberately do
 *  NOT use it (they answer for a signed-out caller instead of throwing). */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** Top 50 rows under `scope`, ranked by the table's own criteria — (moves,
 *  undos, createdAt) for the campaign, with discovery time inserted before the
 *  submission tiebreak on the daily. */
export async function boardRows(
  table: ScoreTable,
  scope: SQL,
): Promise<LeaderRow[]> {
  const elapsed = elapsedColumn(table);
  const rows = await db
    .select({
      userId: table.userId,
      name: user.name,
      username: user.username,
      moves: table.moves,
      undos: table.undos,
      ...(elapsed ? { elapsedMs: elapsed } : {}),
    })
    .from(table)
    .innerJoin(user, eq(table.userId, user.id))
    .where(scope)
    .orderBy(...rankingOrder(liveCriteria(table)))
    .limit(50);
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: r.name,
    username: r.username,
    moves: r.moves,
    clean: r.undos === 0,
    ...(elapsed ? { elapsedMs: r.elapsedMs as number | null } : {}),
  }));
}

/** A user's standing under boardRows' ordering: best moves and positional rank.
 *  Null when the user has no score under `scope`. */
export async function standing(
  table: ScoreTable,
  scope: SQL,
  userId: string,
): Promise<MyResult | null> {
  const elapsed = elapsedColumn(table);
  const [mine] = await db
    .select({
      moves: table.moves,
      undos: table.undos,
      createdAt: table.createdAt,
      ...(elapsed ? { elapsedMs: elapsed } : {}),
    })
    .from(table)
    .where(and(scope, eq(table.userId, userId)))
    .limit(1);
  if (!mine) return null;

  // count everyone who sorts strictly ahead under the SAME criteria the board
  // was ordered by — `mine` carries the time only when the table has it, so the
  // rank can't disagree with the row's position
  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(table)
    .where(and(scope, strictlyAhead(liveCriteria(table), mine)));
  return {
    moves: mine.moves,
    rank: Number(ahead) + 1,
    clean: mine.undos === 0,
    ...(elapsed ? { elapsedMs: mine.elapsedMs as number | null } : {}),
  };
}

/** Writes a validated result into its (scope, user) slot, keeping the better
 *  row per the ranking rule (fewer moves, then fewer corrections, then — on a
 *  table that carries it — a shorter discovery time). `row` carries the table's
 *  scope columns (date + tier for the daily, levelId for the campaign)
 *  alongside the shared score fields; `target` is that table's unique slot.
 *
 *  `elapsedMs` is a parameter rather than a field of `row` on purpose. Passing
 *  it through the row would typecheck against the two-table union while the
 *  `set:` below could not mention it — so an improving score would overwrite
 *  moves, undos and trace and silently leave the old time in place, which is
 *  precisely the value the board now ranks on. Here the value has one path in
 *  and both the insert and the update read it from that path. */
export async function upsertBestScore(
  table: ScoreTable,
  target: IndexColumn[],
  row: ScoreInsert & { undos: number },
  elapsedMs?: number | null,
): Promise<void> {
  // guard on the column, not just the argument: a caller passing a time for a
  // table that has none must be a no-op, never a write to a missing column
  const timed = elapsedMs !== undefined && elapsedColumn(table) !== undefined;
  const timeField = timed ? { elapsedMs } : {};
  await db
    .insert(table)
    .values({ ...row, ...timeField })
    .onConflictDoUpdate({
      target,
      set: {
        moves: row.moves,
        undos: row.undos,
        trace: row.trace,
        createdAt: new Date(),
        ...timeField,
      },
      where: beatenBy(liveCriteria(table), {
        moves: row.moves,
        corrections: row.undos,
        ...timeField,
      }),
    });
}
