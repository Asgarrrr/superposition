// src/ui/hooks/useProgressSync.ts
// At the moment the session resolves to a signed-in user, reconcile local
// progression with the server (planProgressSync): pull down better/absent
// server scores into `record`, and replay-submit better/absent local clean
// traces. Runs at most once per authenticated user (guarded by uid) — session
// is a fresh object each render, so we key on the user id, not the object, and
// read the mutating deps through a ref (as LeaderboardRail does for submit).

import { useEffect, useRef } from "react";
import type { TraceStep } from "../../engine/types.ts";
import { getMyLevelScores, submitLevelScore } from "../../server/campaign.ts";
import { planProgressSync } from "../progressSync.ts";

interface Deps {
  best: Record<string, number>;
  traces: Record<string, TraceStep[]>;
  record: (id: string, moves: number, trace?: TraceStep[]) => void;
}

export function useProgressSync(uid: string | null, deps: Deps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || syncedFor.current === uid) return;
    syncedFor.current = uid;
    let alive = true;

    (async () => {
      const server = await getMyLevelScores().catch(() => null);
      if (!alive || !server) {
        if (syncedFor.current === uid) syncedFor.current = null; // let a retry happen
        return;
      }
      const { best, traces, record } = depsRef.current;
      const plan = planProgressSync(best, traces, server);
      for (const d of plan.downloads) record(d.levelId, d.moves);
      // a stale/invalid trace must not break the sync — swallow per-upload
      for (const u of plan.uploads)
        await submitLevelScore({
          data: { levelId: u.levelId, trace: u.trace },
        }).catch(() => {});
    })();

    return () => {
      alive = false;
    };
  }, [uid]);
}
