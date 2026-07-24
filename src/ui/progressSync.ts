// src/ui/progressSync.ts
// Pure reconciliation of local progression (localStorage) with the server's
// levelScore rows. No React, no I/O — the hook that runs it is the only impure
// part. Downward: pull a server best that beats (or fills) the local best.
// Upward: push a clean local record (one with a stored trace) that beats (or
// is absent from) the server, replayed through the validated submit path.

import type { TraceStep } from "../engine/types.ts";
import { undosOf } from "./submissionPolicy.ts";

export interface ServerScore {
  levelId: string;
  moves: number;
}

export interface SyncPlan {
  downloads: ServerScore[]; // fed to useBestScores.record (which re-applies min)
  uploads: { levelId: string; trace: TraceStep[] }[]; // fed to submitLevelScore
}

export function planProgressSync(
  best: Record<string, number>,
  traces: Record<string, TraceStep[]>,
  server: ServerScore[],
): SyncPlan {
  const serverBy = new Map(server.map((s) => [s.levelId, s.moves]));

  const downloads = server.filter((s) => {
    const local = best[s.levelId];
    return local === undefined || s.moves < local;
  });

  const uploads: SyncPlan["uploads"] = [];
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

  return { downloads, uploads };
}
