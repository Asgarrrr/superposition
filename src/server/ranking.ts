// THE score-ranking rule, defined once: better = fewer moves, ties broken by
// fewer corrections (undos), and — where a total order matters (board display,
// positional rank) — by earliest submission. Pure SQL builders with no db or
// auth imports, so the rule stays testable without a live Postgres.

import { and, asc, eq, gt, lt, or, type Column, type SQL } from "drizzle-orm";

/** The columns the rule reads; both score tables expose them. */
export interface RankColumns {
  moves: Column;
  undos: Column;
  createdAt: Column;
}

/** Upsert guard: true when the stored row loses to the candidate — more moves,
 *  or the same moves with more corrections. Time never demotes a stored row:
 *  an equal result keeps the earlier submission. */
export function beatenBy(
  cols: Pick<RankColumns, "moves" | "undos">,
  candidate: { moves: number; corrections: number },
): SQL {
  // composed operators (not a raw fragment) so the predicate stays
  // parenthesized and safe to and(...) with a scope filter
  return or(
    gt(cols.moves, candidate.moves),
    and(eq(cols.moves, candidate.moves), gt(cols.undos, candidate.corrections)),
  )!;
}

/** The same rule as an ORDER BY, earliest-first as the final tiebreak. */
export function rankingOrder(cols: RankColumns): SQL[] {
  return [asc(cols.moves), asc(cols.undos), asc(cols.createdAt)];
}

/** Rows sorting strictly ahead of `mine` under rankingOrder — the positional
 *  rank is 1 + count(strictlyAhead). */
export function strictlyAhead(
  cols: RankColumns,
  mine: { moves: number; undos: number; createdAt: Date },
): SQL {
  return or(
    lt(cols.moves, mine.moves),
    and(eq(cols.moves, mine.moves), lt(cols.undos, mine.undos)),
    and(
      eq(cols.moves, mine.moves),
      eq(cols.undos, mine.undos),
      lt(cols.createdAt, mine.createdAt),
    ),
  )!;
}
