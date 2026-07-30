// The discovery clock: how the daily's third ranking criterion is derived.
// Pure and DB-free, so every rule below is pinned by unit tests rather than
// inferred from a live board.
//
// What the server can honestly claim: the time is an upper bound on how long
// it has been since THIS ACCOUNT was handed the grid. The client never supplies
// a duration — it has no say in the matter, so it has nothing to forge. Its only
// remaining influence is submitting later, which can only lengthen its own time.
//
// What it deliberately does NOT claim: that this is the player's real discovery
// time. Looking at the grid under one identity and clocking it under another is
// unlinkable, and no cheap defence exists (see the spec's "Ce que le design ne
// prétend pas résoudre").
//
// There is no ceiling. An earlier version capped at 30 minutes so absentees
// would tie instead of being ranked by the length of their lunch — but that
// ordering is meaningless either way (they are last regardless), while a cap set
// below an honest solve collapses REAL solvers, worst of all on the weekend 6×6
// where the spread between players says the most. The bound that matters already
// exists: isSubmittableDay accepts only today or yesterday, so a measurement
// cannot outlive the puzzle.

/** The anchor a submission is measured against, or null when none was ever
 *  written (the player was signed out when the grid was served). */
export interface Anchor {
  servedAt: Date;
  /** The delivery came from a cron-generated puzzle row, not the fallback. */
  certified: boolean;
}

/**
 * Where one player's anchor for one (date, tier) is kept. Scoped to that key by
 * whoever builds it, so nothing here has to carry it around.
 *
 * A seam, not decoration: the rules below decide whether a player is clocked at
 * all, and they used to live inline in the openDaily handler welded to Drizzle,
 * where no test could reach them. Two adapters — Postgres in production, an
 * in-memory fake in the tests.
 */
export interface AnchorStore {
  /** Writes this delivery's anchor if the player has none, and returns what it
   *  wrote — or null when one already existed, having written nothing. */
  insertIfAbsent(servedAt: Date, certified: boolean): Promise<Anchor | null>;
  /** The anchor that already stands, or null. */
  read(): Promise<Anchor | null>;
}

/**
 * Claims this player's anchor. The FIRST delivery wins: a reload, a second tab
 * or a second device all read back the ORIGINAL time rather than being handed a
 * fresh clock — which is the whole point, since a restartable anchor would let
 * a player study the grid and only then start measuring.
 */
export async function claimAnchor(
  store: AnchorStore,
  servedAt: Date,
  certified: boolean,
): Promise<Anchor | null> {
  return (await store.insertIfAbsent(servedAt, certified)) ?? store.read();
}

/**
 * The anchor time to put on screen, as an ISO string, or null to show no clock.
 *
 * Withheld unless the ANCHOR ITSELF says the day is certified — never the
 * provenance just computed. discoveryTime measures against the anchor's own
 * flag, so trusting a fresher one would put a running clock on screen for a
 * submission the server will record as null. A day that gains its cron row
 * after a player was anchored stays uncertified for that player, by design.
 */
export function shownAnchor(anchor: Anchor | null): string | null {
  return anchor?.certified ? anchor.servedAt.toISOString() : null;
}

/**
 * The ranked discovery time for a submission landing at `submittedAt`, or
 * `null` when there is nothing we can honestly measure.
 *
 * Null is the model, not a placeholder: the column is nullable and orders
 * NULLS LAST, so an unmeasured result sits behind every measured one and ties
 * with the other unmeasured ones, falling through to submission order exactly
 * as the board ranked before this criterion existed. The cases:
 *
 *   · no anchor — the grid was served to no one in particular (signed-out play,
 *     later claimed by the first account to sign in, per submissionPolicy);
 *   · an uncertified day — the puzzle row was not written by the cron, so the
 *     grid is the deterministic fallback, which the client can recompute offline
 *     from the bundled LEVELS bank. A time measured on a grid the player could
 *     already know is not a measurement;
 *   · a clock that ran backwards — never trust a negative interval.
 */
export function discoveryTime(
  anchor: Anchor | null,
  submittedAt: Date,
): number | null {
  if (!anchor || !anchor.certified) return null;
  const elapsed = submittedAt.getTime() - anchor.servedAt.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  return elapsed;
}
