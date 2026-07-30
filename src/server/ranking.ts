// THE score-ranking rule, defined once: better = fewer moves, ties broken by
// fewer corrections (undos), then — on the daily only — by a shorter
// server-measured discovery time, and finally, where a total order matters
// (board display, positional rank), by earliest submission. Pure SQL builders
// with no db or auth imports, so the rule stays testable without a live
// Postgres.
//
// The discovery-time criterion is OPTIONAL throughout: `elapsedMs` exists on
// daily_score and not on level_score, so passing a table in decides the rule
// that applies to it. Absent the column, every builder below renders exactly
// the SQL it rendered before the criterion existed — that is what keeps the
// campaign board unchanged without carrying a dead column.
//
// It is also OFF for now. `liveCriteria` withholds the column from every builder
// while TIME_RANKS is false, so the time is measured, stored and displayed but
// ranks nothing yet; see that constant for why. The builders themselves are
// written and tested as if it were on, so enabling it is one edit.
//
// The column is also NULLABLE, and null means "we could not honestly measure
// this" (see server/discovery.ts). Unmeasured results order LAST and tie with
// each other, falling through to submission order — precisely how the board
// ranked before the criterion existed. SQL will not compare nulls for us, so
// every clause below spells out what null means rather than letting a
// three-valued comparison quietly drop rows from a count.

import {
  and,
  asc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type Column,
  type SQL,
} from "drizzle-orm";

/** The columns the rule reads. Both score tables expose the first three;
 *  `elapsedMs` is the daily's alone. */
export interface RankColumns {
  moves: Column;
  undos: Column;
  createdAt: Column;
  elapsedMs?: Column;
}

/** A ranked time: a measurement, or null for one we could not take. `undefined`
 *  is different again — the criterion does not apply to this board at all. */
type Time = number | null;

/**
 * Whether the discovery time ORDERS the daily board yet.
 *
 * False on purpose. The time is measured, stored and displayed from day one,
 * but it does not rank — the board still breaks ties on submission order. The
 * saturation this criterion answers (everyone at the solver's optimum with no
 * corrections, leaving only "who played earliest" to separate them) is a
 * prediction; running measured-but-unranked turns it into an observation, at no
 * risk. And ranking on time is precisely what gives cheating a payoff: replaying
 * a memorised solution wins a few places today, but would win first place
 * outright once time decides. Pay that price when the data shows the ties are
 * real.
 *
 * Flipping this to true enables the criterion everywhere at once — the column is
 * already filling, so past days become rankable too. Every builder below is
 * tested in both states, so the flip is covered before it happens.
 */
const TIME_RANKS = false;

/** The criteria actually live for a board, given the setting above. Dropping
 *  `elapsedMs` here is what keeps the time measured-but-unranked, and it is
 *  dropped in ONE place so the ORDER BY, the upsert guard and the positional
 *  rank can never disagree about which criteria apply. Callers pass their score
 *  table straight in: it satisfies RankColumns structurally, and only the daily
 *  carries the column at all. */
export function liveCriteria(cols: RankColumns): RankColumns {
  return {
    moves: cols.moves,
    undos: cols.undos,
    createdAt: cols.createdAt,
    ...(TIME_RANKS && cols.elapsedMs ? { elapsedMs: cols.elapsedMs } : {}),
  };
}

/** Upsert guard: true when the stored row loses to the candidate — more moves,
 *  the same moves with more corrections, or (daily) an equal result reached in
 *  more time. Submission time never demotes a stored row: a result equal on
 *  every ranked criterion keeps the earlier submission.
 *
 *  `elapsedMs` must be supplied whenever the table carries the column, or a
 *  re-solve that only improves the time would never replace the stored row —
 *  the caller and the ORDER BY would then disagree about what "better" means. */
export function beatenBy(
  cols: Pick<RankColumns, "moves" | "undos" | "elapsedMs">,
  candidate: { moves: number; corrections: number; elapsedMs?: Time },
): SQL {
  // composed operators (not a raw fragment) so the predicate stays
  // parenthesized and safe to and(...) with a scope filter
  const sameResult = [
    eq(cols.moves, candidate.moves),
    eq(cols.undos, candidate.corrections),
  ];
  const col = cols.elapsedMs;
  const beatenOnTime =
    col && candidate.elapsedMs !== undefined
      ? slower(col, candidate.elapsedMs)
      : undefined;
  return or(
    gt(cols.moves, candidate.moves),
    and(eq(cols.moves, candidate.moves), gt(cols.undos, candidate.corrections)),
    beatenOnTime && and(...sameResult, beatenOnTime),
  )!;
}

/** The stored column sorts behind `value` under NULLS LAST: it is unmeasured
 *  while the candidate is measured, or both are measured and it is larger.
 *  Nothing sorts behind an unmeasured candidate, so one can never win here. */
function slower(col: Column, value: Time): SQL | undefined {
  return value === null ? undefined : or(isNull(col), gt(col, value));
}

/** The rule as an ORDER BY, earliest submission as the final tiebreak.
 *  `nulls last` is spelled out rather than left to the dialect's default: the
 *  whole placement of unmeasured results rests on it. */
export function rankingOrder(cols: RankColumns): SQL[] {
  return [
    asc(cols.moves),
    asc(cols.undos),
    ...(cols.elapsedMs ? [sql`${cols.elapsedMs} asc nulls last`] : []),
    asc(cols.createdAt),
  ];
}

/** Rows sorting strictly ahead of `mine` under rankingOrder — the positional
 *  rank is 1 + count(strictlyAhead). Each clause carries the equality on every
 *  criterion above it, so the count can never disagree with the row's actual
 *  position. With a nullable criterion, "equal" has to include "both
 *  unmeasured", which plain SQL equality would never report. */
export function strictlyAhead(
  cols: RankColumns,
  mine: { moves: number; undos: number; elapsedMs?: Time; createdAt: Date },
): SQL {
  const col = cols.elapsedMs;
  const timed = col !== undefined && mine.elapsedMs !== undefined;
  const sameResult = [eq(cols.moves, mine.moves), eq(cols.undos, mine.undos)];
  const mineMs = mine.elapsedMs ?? null;
  return or(
    lt(cols.moves, mine.moves),
    and(eq(cols.moves, mine.moves), lt(cols.undos, mine.undos)),
    timed ? and(...sameResult, faster(col, mineMs)) : undefined,
    and(
      ...sameResult,
      ...(timed ? [sameTime(col, mineMs)] : []),
      lt(cols.createdAt, mine.createdAt),
    ),
  )!;
}

/** Sorts ahead of `mine` on the time criterion under NULLS LAST: when mine is
 *  unmeasured every measured row is ahead, otherwise only a smaller one is. */
function faster(col: Column, mine: Time): SQL {
  return mine === null ? isNotNull(col) : lt(col, mine);
}

/** Ties with `mine` on the time criterion — including two unmeasured rows,
 *  which SQL equality alone would never report as equal. */
function sameTime(col: Column, mine: Time): SQL {
  return mine === null ? isNull(col) : eq(col, mine);
}
