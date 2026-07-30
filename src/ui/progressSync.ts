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

/** One of the caller's stored rows. `undos` is the correction count of that
 *  stored best — zero means the row earned the clean seal. */
export interface ServerScore {
  levelId: string;
  moves: number;
  undos: number;
}

/**
 * A stored row as a win the ledger can take.
 *
 * No trace: the server holds one, but sending it back would only let the ledger
 * store a trace for a record it may not match. The ledger drops any stale one
 * instead, and the upload path re-reads the trace from the server anyway.
 *
 * The seal comes from the row's own correction count, which is what the boards
 * already rank and seal on. Note what this cannot recover: the server keeps one
 * row per level, not a history, so a player whose clean run was NOT their best
 * row has no "ever solved cleanly" fact for the server to return.
 */
export const asWin = (s: ServerScore): Win => ({
  levelId: s.levelId,
  moves: s.moves,
  clean: s.undos === 0,
});

export interface Upload {
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
