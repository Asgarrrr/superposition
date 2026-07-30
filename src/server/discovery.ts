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
