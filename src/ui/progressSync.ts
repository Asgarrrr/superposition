// src/ui/progressSync.ts
// The UPWARD half of the login-time reconciliation, as a pure plan: which local
// clean records are worth replaying to the server. No React, no I/O — the hook
// that runs it is the only impure part.
//
// There is no downward half here on purpose. Deciding "is this server score
// better than mine?" is the ledger's own new-best rule, and this module used to
// spell it a second time (`local === undefined || s.moves < local`, character
// for character `recordWin`'s gate). Two spellings of one rule is exactly the
// drift this codebase avoids elsewhere, so the hook now offers EVERY server row
// to the ledger and lets it apply its own rules — min for the record, sticky for
// the clean flag. A row that changes nothing returns the same ledger object, so
// the offer costs a reference comparison and no render.

import type { TraceStep } from "../engine/types.ts";
import type { Ledger, Win } from "./progression.ts";
import { undosOf } from "./submissionPolicy.ts";

/** One of the caller's stored rows. Two facts, deliberately not one: `undos` is
 *  the correction count of that STORED BEST — what the boards rank and seal on,
 *  and what `planUploads` breaks a tie on — while `everClean` says the level was
 *  once solved with no correction at all, true even when that run is not the row
 *  the server kept. */
export interface ServerScore {
  levelId: string;
  moves: number;
  undos: number;
  everClean: boolean;
}

/**
 * A stored row as a win the ledger can take.
 *
 * No trace: the server holds one, but sending it back would only let the ledger
 * store a trace for a record it may not match. The ledger drops any stale one
 * instead, and the upload path re-reads the trace from the server anyway.
 *
 * The seal comes from `everClean`, NOT from the row's own correction count. The
 * server keeps one best row per level, not a history, so reading the row would
 * drop the seal of a player whose "sans retouche" run was not their record —
 * the very gap that column was added to close. It remembers the fact on the
 * player's behalf; here the ledger just takes it, sticky as ever.
 */
export const asWin = (s: ServerScore): Win => ({
  levelId: s.levelId,
  moves: s.moves,
  clean: s.everClean,
});

interface Upload {
  levelId: string;
  trace: TraceStep[];
}

/** Local clean records worth replaying through the validated submit path. */
export function planUploads(ledger: Ledger, server: ServerScore[]): Upload[] {
  const { best, traces } = ledger;
  const serverBy = new Map(server.map((s) => [s.levelId, s.moves]));

  const uploads: Upload[] = [];
  for (const [levelId, trace] of Object.entries(traces)) {
    const local = best[levelId];
    if (local === undefined) continue; // a trace with no recorded best: ignore
    const remote = serverBy.get(levelId);
    // Fewer moves always uploads. On a tie, only a CLEAN local trace is worth
    // sending: the server's undo tie-break lets it replace a non-clean row of
    // equal moves and earn the "sans retouche" seal, whereas a non-clean tie
    // would be a pure no-op upsert (wasted POST + replay). The stored best trace
    // isn't necessarily clean, so gate the tie on it here.
    if (
      remote === undefined ||
      local < remote ||
      (local === remote && undosOf(trace) === 0)
    )
      uploads.push({ levelId, trace });
  }

  return uploads;
}
