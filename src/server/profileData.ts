// Server-only data access for profiles. Kept out of `profile.ts` because that
// module's server functions are imported by client route code (for their RPC
// stubs); an *exported* function that touches `db` there would drag the pg /
// drizzle stack (and the Node `Buffer` global) into the client bundle. Here the
// db access lives behind plain functions that only server contexts import — the
// public RPC handler and the OG-image route.

import { asc, count, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyScore, user } from "../db/schema.ts";
import { USERNAME_RE } from "../lib/username.ts";

export interface DailyHistory {
  name: string; // display name for the header
  joinedAt: string; // YYYY-MM-DD (UTC) — where the grid starts
  days: { date: string; count: number }[]; // tiers solved per day, ascending
}

const FIELDS = {
  id: user.id,
  name: user.name,
  createdAt: user.createdAt,
} as const;

/** The completion history for one account row: for each day they solved at least
 *  one tier, how many tiers (1–4). */
async function historyFor(row: {
  name: string;
  createdAt: Date;
  id: string;
}): Promise<DailyHistory> {
  const rows = await db
    .select({ date: dailyScore.date, count: count() })
    .from(dailyScore)
    .where(eq(dailyScore.userId, row.id))
    .groupBy(dailyScore.date)
    .orderBy(asc(dailyScore.date));

  return {
    name: row.name,
    joinedAt: row.createdAt.toISOString().slice(0, 10),
    days: rows.map((r) => ({ date: r.date, count: Number(r.count) })),
  };
}

/** A signed-in player's own history by id, or null when the row is gone. */
export async function historyById(
  userId: string,
): Promise<DailyHistory | null> {
  const [row] = await db
    .select(FIELDS)
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ? historyFor(row) : null;
}

/** A player's history by username, or null when the handle is malformed or no
 *  such account exists. Usernames are stored lowercased by the plugin, so the
 *  lookup is normalized to match. */
export async function historyByUsername(
  username: string,
): Promise<DailyHistory | null> {
  if (!USERNAME_RE.test(username)) return null;
  const [row] = await db
    .select(FIELDS)
    .from(user)
    .where(eq(user.username, username.toLowerCase()))
    .limit(1);
  return row ? historyFor(row) : null;
}
