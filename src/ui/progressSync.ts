// src/ui/progressSync.ts
// Pure reconciliation of local progression (localStorage) with the server's
// levelScore rows. No React, no I/O — the hook that runs it is the only impure
// part. Downward: pull a server best that beats (or fills) the local best.
// Upward: push a clean local record (one with a stored trace) that beats (or
// is absent from) the server, replayed through the validated submit path.

import type { TraceStep } from "../engine/types.ts";

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
    if (remote === undefined || local < remote)
      uploads.push({ levelId, trace });
  }

  return { downloads, uploads };
}
