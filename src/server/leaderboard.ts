// Shared ranking queries for the two score boards — the daily (scoped by date)
// and the campaign (scoped by level). Both tables expose the same shape
// (userId, moves, undos, createdAt); the only difference is the table and the
// scope predicate, so the ranking rule — top 50 by fewest moves, then fewest
// corrections, then earliest — lives here once instead of in both callers.

import { and, asc, count, eq, lt, or, type SQL } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyScore, levelScore, user } from "../db/schema.ts";
import type { LeaderRow, MyResult } from "./daily.ts";

type ScoreTable = typeof dailyScore | typeof levelScore;

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
    .orderBy(asc(table.moves), asc(table.undos), asc(table.createdAt))
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
    .where(
      and(
        scope,
        or(
          lt(table.moves, mine.moves),
          and(eq(table.moves, mine.moves), lt(table.undos, mine.undos)),
          and(
            eq(table.moves, mine.moves),
            eq(table.undos, mine.undos),
            lt(table.createdAt, mine.createdAt),
          ),
        ),
      ),
    );
  return { moves: mine.moves, rank: Number(ahead) + 1 };
}
