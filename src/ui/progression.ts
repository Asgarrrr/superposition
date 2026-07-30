// The progression ledger: everything the edition remembers about one player's
// own campaign, as a value with pure transitions.
//
// It used to be four loose dictionaries handed straight to callers, who each
// re-derived meaning from them — the selector decided inline what "tiré" versus
// "solved with a hint" meant and folded a chapter by hand, stamps.ts took two of
// the four as arguments, the sync took two others. The rules that mattered (a
// new best gates the trace, the clean flag is sticky and sits OUTSIDE that gate)
// lived inside a React hook, where no test could reach them.
//
// Here the ledger answers questions instead of exposing its dictionaries:
// `plate` for one board, `setPulled` for a chapter. The hook that holds it
// (useBestScores) is the only impure part — it reads and writes localStorage and
// nothing else.

import type { TraceStep } from "../engine/types.ts";
import { LEVELS } from "../engine/levels.ts";
import { PAR } from "../engine/par.ts";

/** What is persisted. Four maps keyed by level id, kept as separate storage
 *  keys for history — the shape is the ledger's business, not its callers'. */
export interface Ledger {
  /** Best move count per level. Absent = never put on the record. */
  readonly best: Record<string, number>;
  /** Cleared with a hint: solved, but off the record — no move count. */
  readonly hinted: Record<string, true>;
  /** Ever cleared with no correction. Sticky once earned. */
  readonly clean: Record<string, true>;
  /** The winning trace of each level's current best, for replay-submission. */
  readonly traces: Record<string, TraceStep[]>;
}

export const emptyLedger: Ledger = {
  best: {},
  hinted: {},
  clean: {},
  traces: {},
};

/** A win offered to the ledger. `trace` is present for a locally-played win and
 *  absent for a best pulled down from the server, which is the distinction the
 *  trace-keeping rule below turns on. */
export interface Win {
  levelId: string;
  moves: number;
  trace?: TraceStep[];
  /** The run reached the win with no correction — no undo since the last
   *  reset. Sticky, and independent of whether this was a new best. */
  clean?: boolean;
}

/**
 * Records a win.
 *
 * The sticky "sans retouche" flag rises on ANY correction-free win, best or
 * not, so it sits outside the new-best gate. The trace, by contrast, is kept
 * only for the CURRENT best so it and `best` can never disagree: a new clean
 * best stores its trace, a new best pulled from the server (which carries none)
 * drops the now-stale one, and a worse replay changes nothing at all.
 *
 * A pure transition on purpose: applied through a functional setState, several
 * wins landing in one tick compose correctly without the mirror-ref the hook
 * used to need to decide "is this a new best?" outside setState's timing.
 */
export function recordWin(ledger: Ledger, win: Win): Ledger {
  const { levelId, moves, trace, clean } = win;
  let next = ledger;
  if (clean && !ledger.clean[levelId])
    next = { ...next, clean: { ...next.clean, [levelId]: true } };

  const prev = ledger.best[levelId];
  if (prev !== undefined && moves >= prev) return next;

  const traces = { ...next.traces };
  if (trace) traces[levelId] = trace;
  else delete traces[levelId];
  return { ...next, best: { ...next.best, [levelId]: moves }, traces };
}

/** Marks a level cleared with a hint. Returns the SAME ledger when nothing
 *  changes, so a repeat can't spend a render. */
export function markHinted(ledger: Ledger, levelId: string): Ledger {
  if (ledger.hinted[levelId]) return ledger;
  return { ...ledger, hinted: { ...ledger.hinted, [levelId]: true } };
}

/** Whether `moves` matches the solver's certified optimum for a level — the
 *  "bon à tirer" rule, spelled once. An unknown id has no par, so it can never
 *  be at par. */
export function atPar(levelId: string, moves: number | undefined): boolean {
  const par = PAR[levelId];
  return moves !== undefined && par !== undefined && moves <= par;
}

/** What the selector and the overlays ask about one plate. */
export interface Plate {
  /** The record: fewest moves, on the record. Undefined = never pulled. */
  readonly record: number | undefined;
  /** Cleared with a hint and never on the record — a dim mark, no count. */
  readonly hinted: boolean;
  /** bon à tirer — the record matches the solver's optimum. */
  readonly bat: boolean;
  /** sans retouche — cleared at least once with no correction. */
  readonly sans: boolean;
}

export function plate(ledger: Ledger, levelId: string): Plate {
  const record = ledger.best[levelId];
  return {
    record,
    // a hint mark only ever shows where there is no record to show instead
    hinted: !!ledger.hinted[levelId],
    bat: atPar(levelId, record),
    sans: !!ledger.clean[levelId],
  };
}

/** Whether every plate of a chapter is on the record — the whole set is pulled.
 *  A chapter with no plates is not "pulled": there is nothing to have pulled. */
export function setPulled(ledger: Ledger, chapter: string): boolean {
  const plates = LEVELS.filter((lv) => lv.ch === chapter);
  return (
    plates.length > 0 && plates.every((lv) => ledger.best[lv.id] !== undefined)
  );
}
