// Server functions for the daily puzzle (RPC, since SSR is off). The puzzle is
// written daily by the cron generator; with no row yet we fall back to a
// deterministic pick from the level bank so /daily is always playable.

import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { dailyPuzzle, dailyScore, dailyView } from "../db/schema.ts";
import { isValidDay, isWeekend, utcDay } from "../lib/day.ts";
import { computeStreaks } from "../lib/streak.ts";
import { Lru } from "../lib/lru.ts";
import {
  boardRows,
  currentUserId,
  requireUserId,
  standing,
  upsertBestScore,
} from "./leaderboard.ts";
import { validateTrace, validateTraceShape } from "./replay.ts";
import {
  WEEKEND_TIER,
  fetchRow,
  puzzleFor,
  resolveWithProvenance,
  type DailyPuzzle,
} from "./dailyPuzzle.ts";
import {
  claimAnchor,
  discoveryTime,
  shownAnchor,
  type Anchor,
  type AnchorStore,
} from "./discovery.ts";
import type { BoardData } from "./leaderboard.ts";
import type { TraceStep } from "../engine/types.ts";

// The resolution internals (fallback bands, weekend row, puzzleFor) live in
// dailyPuzzle.ts, NOT here: this module is imported by client components for
// its server functions, and a plain value export touching the db would drag
// drizzle/pg into the client bundle. Only server functions and types may be
// exported from this file.
export type { DailyPuzzle } from "./dailyPuzzle.ts";

const TIERS = [0, 1, 2, 3] as const;

/** A tier index (0 easy · 1 medium · 2 hard · 3 weekend épreuve), or throws. */
function asTier(v: unknown): number {
  if (typeof v === "number" && TIERS.includes(v as (typeof TIERS)[number]))
    return v;
  throw new Error("invalid tier");
}

/** A score is accepted for today, or yesterday as a grace window for a player
 *  who crosses UTC midnight mid-solve — never for an arbitrary day. */
function isSubmittableDay(date: string): boolean {
  return date === utcDay(0) || date === utcDay(-1);
}

/** What the board needs to start: the grid, and the clock it starts. */
export interface DailyOpening {
  /** Null only for an absent weekend épreuve — the route redirects. */
  puzzle: DailyPuzzle | null;
  /** The immutable anchor for this player — null whenever this result will not
   *  be timed: signed out (nothing to anchor to), or an uncertified day whose
   *  grid the client could recompute offline. The clock on screen therefore
   *  appears only when a clock actually counts, instead of running for minutes
   *  beside a board that rightly shows no time. The server never reads this
   *  back from the client; it is display only. */
  servedAt: string | null;
  /** The server's clock at reply time, so the client can offset its own rather
   *  than trust it. Display only — the ranked time is measured server-side. */
  serverNow: string;
}

/**
 * Opens a tier of the day: hands over the grid AND starts this player's
 * discovery clock, in one call.
 *
 * The two are inseparable on purpose. If the grid were reachable through any
 * other route, a player could take it, study it at leisure, and only then start
 * an clock on a puzzle they had already solved — which is why the two functions
 * that used to serve it (getDailyPuzzle, getWeekendDaily) are gone rather than
 * merely unused: an exported server function is a public HTTP endpoint under
 * /_serverFn, so leaving them in place would leave the grid reachable.
 *
 * POST, not GET, because it writes: the CSRF middleware only gates non-GET
 * server functions (src/start.ts), and a GET here would let a crafted link
 * burn a third party's anchor — which is immutable, so the damage would stick.
 *
 * The anchor is `onConflictDoNothing`: the FIRST delivery wins, so reloading
 * the route, a second tab or a second device all read back the original time.
 */
export const openDaily = createServerFn({ method: "POST" })
  .validator((data: unknown): { tier: number } => ({
    tier: asTier((data as { tier?: unknown } | null)?.tier),
  }))
  .handler(async ({ data }): Promise<DailyOpening> => {
    const date = utcDay();
    const { tier } = data;
    const serverNow = new Date();

    // the weekend tier exists only on Sat/Sun and only if the cron wrote it
    if (tier === WEEKEND_TIER && !isWeekend(date))
      return {
        puzzle: null,
        servedAt: null,
        serverNow: serverNow.toISOString(),
      };

    const { puzzle, certified } = await resolveWithProvenance(date, tier);
    const userId = await currentUserId();
    if (!puzzle || !userId)
      return {
        puzzle,
        servedAt: null,
        serverNow: serverNow.toISOString(),
      };

    // the lifecycle rules — first delivery wins, the stored flag is the
    // authority, a clock is shown only where one is actually running — live in
    // discovery.ts alongside the measurement they feed, and are tested there
    const anchor = await claimAnchor(
      anchorsFor(date, tier, userId),
      serverNow,
      certified,
    );
    return {
      puzzle,
      servedAt: shownAnchor(anchor),
      serverNow: serverNow.toISOString(),
    };
  });

/** Whether today's weekend épreuve is playable. A boolean, deliberately: the
 *  selector only needs to know whether to show the plate, and the previous
 *  version answered that by handing the whole 6×6 grid to every visitor of
 *  /levels — hours before anyone entered the puzzle. */
export const getWeekendAvailable = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    const date = utcDay();
    return isWeekend(date) && (await fetchRow(date, WEEKEND_TIER)) !== null;
  },
);

/** The Postgres adapter behind the anchor seam, bound to one (date, tier,
 *  player). `onConflictDoNothing` is what makes the first delivery win: a
 *  second call writes nothing and returns nothing, so claimAnchor reads the
 *  original back. */
function anchorsFor(date: string, tier: number, userId: string): AnchorStore {
  const mine = and(
    eq(dailyView.date, date),
    eq(dailyView.tier, tier),
    eq(dailyView.userId, userId),
  );
  return {
    async insertIfAbsent(servedAt, certified): Promise<Anchor | null> {
      const [written] = await db
        .insert(dailyView)
        .values({ date, tier, userId, servedAt, certified })
        .onConflictDoNothing()
        .returning({ servedAt: dailyView.servedAt });
      // a row we just wrote carries the `certified` we just computed
      return written ? { servedAt: written.servedAt, certified } : null;
    },
    async read(): Promise<Anchor | null> {
      const [row] = await db
        .select({
          servedAt: dailyView.servedAt,
          certified: dailyView.certified,
        })
        .from(dailyView)
        .where(mine)
        .limit(1);
      return row ?? null;
    },
  };
}

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
  .validator(
    (data: unknown): { trace: TraceStep[]; date: string; tier: number } => {
      const d = data as {
        trace?: unknown;
        date?: unknown;
        tier?: unknown;
      } | null;
      const trace = validateTraceShape(d?.trace);
      if (typeof d?.date !== "string" || !isValidDay(d.date))
        throw new Error("invalid date");
      return { trace, date: d.date, tier: asTier(d?.tier) };
    },
  )
  .handler(async ({ data }): Promise<SubmitResult> => {
    const userId = await requireUserId();
    if (!isSubmittableDay(data.date)) throw new Error("Puzzle no longer open");

    const { date, tier } = data;
    const puzzle = await puzzleFor(date, tier);
    if (!puzzle) throw new Error("Puzzle not available");
    const result = validateTrace(puzzle.level, data.trace);
    if (!result.ok) throw new Error("Invalid solution");

    // Guarantee the puzzle row exists (fallback tiers have none) so the score FK
    // holds — this also pins the fallback as this tier's official puzzle.
    await db
      .insert(dailyPuzzle)
      .values({ date, tier, level: puzzle.level, optimal: puzzle.optimal })
      .onConflictDoNothing();

    // The ranked discovery time, derived entirely server-side from this
    // player's anchor; null when there is nothing we can honestly measure. The
    // client sends a trace and nothing else — it has no way to state, shorten
    // or round its own time.
    const elapsedMs = discoveryTime(
      await anchorsFor(date, tier, userId).read(),
      new Date(),
    );

    // Keep the best result for this (date, tier, user) per the shared rule.
    await upsertBestScore(
      dailyScore,
      [dailyScore.date, dailyScore.tier, dailyScore.userId],
      {
        date,
        tier,
        userId,
        moves: result.moves,
        undos: result.corrections,
        trace: data.trace,
      },
      elapsedMs,
    );

    return { ok: true, moves: result.moves };
  });

// optimal is fixed per (date, tier), so resolve the puzzle for it at most once
// per key per process instead of on every board read (which is a daily_puzzle
// SELECT, or the solver on a cron-missed tier). Bounded for the same reason as
// fallbackCache: distinct past (date, tier) reads must not grow memory forever.
const optimalByKey = new Lru<string, number>(256);
async function dailyOptimal(date: string, tier: number): Promise<number> {
  const key = `${date}:${tier}`;
  const cached = optimalByKey.get(key);
  if (cached !== undefined) return cached;
  const puzzle = await puzzleFor(date, tier);
  // an absent weekend épreuve reads as an empty board (optimal 0); don't cache
  // the miss, so it picks up the row once the cron writes it
  if (!puzzle) return 0;
  optimalByKey.set(key, puzzle.optimal);
  return puzzle.optimal;
}

/** The board for a specific day (optimal, top 50, and — if signed in — the
 *  caller's own standing) in one round trip. The date is the day the client is
 *  playing (the loader's), NOT the server's current utcDay(): a solve that
 *  crosses UTC midnight must still read the board it submitted to. Public:
 *  reading needs no account; the caller's standing is queried only with a
 *  session. */
export const getDailyBoard = createServerFn({ method: "GET" })
  .validator((data: unknown): { date: string; tier: number } => {
    const d = data as { date?: unknown; tier?: unknown } | null;
    if (typeof d?.date !== "string" || !isValidDay(d.date))
      throw new Error("invalid date");
    // never answer for a day that hasn't happened: the cron writes J+1/J+2 in
    // advance, and `optimal` would otherwise leak tomorrow's par — enough to
    // tell a certified day from a fallback one, and to know it early
    if (d.date > utcDay()) throw new Error("invalid date");
    return { date: d.date, tier: asTier(d?.tier) };
  })
  .handler(async ({ data }): Promise<BoardData> => {
    const { date, tier } = data;
    const scope = and(eq(dailyScore.date, date), eq(dailyScore.tier, tier))!;
    const userId = await currentUserId();
    const [optimal, rows, mine] = await Promise.all([
      dailyOptimal(date, tier),
      boardRows(dailyScore, scope),
      userId ? standing(dailyScore, scope, userId) : Promise.resolve(null),
    ]);
    return { optimal, rows, mine };
  });

/** The signed-in player's current daily streak (consecutive UTC days with at
 *  least one tier solved), for the discreet reminder on the daily win screen.
 *  Zero when signed out — the reminder simply doesn't show.
 *
 *  The client passes the date of the puzzle it just solved (`solved`), and only
 *  that date is optimistically unioned into the played set, so the reminder is
 *  right even when this read races the rail's score upsert. We deliberately do
 *  NOT union the server's current utcDay(): during the grace window a player
 *  can solve *yesterday's* puzzle after UTC midnight, and unioning "today"
 *  would credit a day never played — inflating the streak by one. computeStreaks
 *  already grants a yesterday grace anchor, so no server-side "today" is needed.
 *  This union is optimistic: it credits the locally-solved day even if the score
 *  submit later fails; a transient failure resolves on the next solve/retry. */
export const getMyStreak = createServerFn({ method: "GET" })
  .validator((data: unknown): { solved: string | null } => {
    const d = data as { solved?: unknown } | null;
    if (d?.solved === undefined || d?.solved === null) return { solved: null };
    // accept only a submittable day (today or yesterday) — never an arbitrary
    // date the client could inject to fabricate a run
    if (typeof d.solved !== "string" || !isSubmittableDay(d.solved))
      throw new Error("invalid date");
    return { solved: d.solved };
  })
  .handler(async ({ data }): Promise<{ current: number }> => {
    const userId = await currentUserId();
    if (!userId) return { current: 0 };
    const rows = await db
      // distinct days played — the same set profileData.historyFor derives (there
      // with a per-day count); kept separate as this path needs only the dates
      .select({ date: dailyScore.date })
      .from(dailyScore)
      .where(eq(dailyScore.userId, userId))
      .groupBy(dailyScore.date);
    const days = rows.map((r) => r.date);
    if (data.solved) days.push(data.solved);
    return { current: computeStreaks(days, utcDay()).current };
  });
