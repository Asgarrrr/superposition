// Server-only data access for profiles. Kept out of `profile.ts` because that
// module's server functions are imported by client route code (for their RPC
// stubs); an *exported* function that touches `db` there would drag the pg /
// drizzle stack (and the Node `Buffer` global) into the client bundle. Here the
// db access lives behind plain functions that only server contexts import — the
// public RPC handler and the OG-image route.
//
// This module GATHERS; it decides nothing. Which dates count as a "bon à tirer"
// is a rule, and rules about tiers and thresholds live in lib/distinctions.ts.

import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyPuzzle, dailyScore, levelScore, user } from "../db/schema.ts";
import { USERNAME_RE } from "../lib/username.ts";
import { PAR } from "../engine/par.ts";
import { WEEKEND_TIER } from "./dailyPuzzle.ts";
import type { DistinctionInput } from "../lib/distinctions.ts";

/** One campaign board the player has put on the record. */
export interface PlateRecord {
  levelId: string;
  moves: number;
  undos: number;
}

export interface DailyHistory {
  name: string; // display name for the header
  joinedAt: string; // YYYY-MM-DD (UTC) — where the grid starts
  days: { date: string; count: number }[]; // tiers solved per day, ascending
  /** Every date the distinction rules need. Fed straight to `distinctions()`. */
  marks: DistinctionInput;
  /** The campaign records, for the edition section and the plate count. */
  plates: PlateRecord[];
  /** Correction-free solves, daily and campaign — one of the four figures. */
  cleanCount: number;
}

const FIELDS = {
  id: user.id,
  name: user.name,
  createdAt: user.createdAt,
} as const;

const asDay = (at: Date): string => at.toISOString().slice(0, 10);

/** Everything one account's profile prints. Two reads: the player's daily
 *  results joined to the day's certified optimum, and their campaign records.
 *  Both are bounded — one row per (day, tier) played, at most one per level —
 *  so they are folded in JS rather than in SQL, which keeps the counting rules
 *  next to each other and out of the query language. */
async function historyFor(row: {
  name: string;
  createdAt: Date;
  id: string;
}): Promise<DailyHistory> {
  const [daily, campaign] = await Promise.all([
    db
      .select({
        date: dailyScore.date,
        tier: dailyScore.tier,
        moves: dailyScore.moves,
        undos: dailyScore.undos,
        optimal: dailyPuzzle.optimal,
      })
      .from(dailyScore)
      .innerJoin(
        dailyPuzzle,
        and(
          eq(dailyScore.date, dailyPuzzle.date),
          eq(dailyScore.tier, dailyPuzzle.tier),
        ),
      )
      .where(eq(dailyScore.userId, row.id)),
    db
      .select({
        levelId: levelScore.levelId,
        moves: levelScore.moves,
        undos: levelScore.undos,
        createdAt: levelScore.createdAt,
      })
      .from(levelScore)
      .where(eq(levelScore.userId, row.id)),
  ]);

  // tiers solved per day, ascending — the contribution grid
  const perDay = new Map<string, number>();
  for (const r of daily) perDay.set(r.date, (perDay.get(r.date) ?? 0) + 1);
  const days = [...perDay]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // a "bon à tirer" is a solve at the solver's certified optimum. The daily's
  // optimum rides on its puzzle row; the campaign's lives in code (PAR), which
  // is why the campaign side is filtered here and not in the query. A level id
  // with no par can never qualify, the same rule `atPar` spells for the ledger.
  const bat = [
    ...daily.filter((r) => r.moves <= r.optimal).map((r) => r.date),
    ...campaign
      .filter((r) => PAR[r.levelId] !== undefined && r.moves <= PAR[r.levelId]!)
      .map((r) => asDay(r.createdAt)),
  ];

  const marks: DistinctionInput = {
    days: days.map((d) => d.date),
    bat,
    artist: daily.filter((r) => r.tier === WEEKEND_TIER).map((r) => r.date),
    plates: campaign.map((r) => asDay(r.createdAt)),
  };

  return {
    name: row.name,
    joinedAt: asDay(row.createdAt),
    days,
    marks,
    plates: campaign.map((r) => ({
      levelId: r.levelId,
      moves: r.moves,
      undos: r.undos,
    })),
    cleanCount:
      daily.filter((r) => r.undos === 0).length +
      campaign.filter((r) => r.undos === 0).length,
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
