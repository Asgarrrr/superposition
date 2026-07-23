// src/ui/hooks/useProgressSync.ts
// At the moment the session resolves to a signed-in user, reconcile local
// progression with the server (planProgressSync): pull down better/absent
// server scores into `record`, and replay-submit better/absent local clean
// traces. Keyed on the user id (session is a fresh object each render), so it
// runs once per account change; a genuine remount re-runs it, which is safe —
// downloads re-apply min and uploads upsert the best, both idempotent. The
// mutating deps are read through a ref (as LeaderboardRail does for submit).

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
  // stale-run guard: bumped on cleanup so an aborted mount's continuation can't
  // apply its results. This is what makes StrictMode's throwaway first mount
  // (and any account change mid-flight) safe — the discarded run never touches
  // state, and the surviving run isn't suppressed. Mirrors LeaderboardRail's
  // `generation` idiom; a boolean "have I started?" flag can't do both.
  const generation = useRef(0);

  useEffect(() => {
    if (!uid) return;
    const g = generation; // the counter object itself, not a DOM snapshot
    const gen = ++g.current;

    (async () => {
      const server = await getMyLevelScores().catch(() => null);
      if (gen !== g.current || !server) return;
      const { best, traces, record } = depsRef.current;
      const plan = planProgressSync(best, traces, server);
      for (const d of plan.downloads) record(d.levelId, d.moves);
      // independent per-level upserts: fire together rather than serializing N
      // round-trips. A stale/invalid trace must not break the others — swallow
      // per-upload.
      await Promise.all(
        plan.uploads.map((u) =>
          submitLevelScore({
            data: { levelId: u.levelId, trace: u.trace },
          }).catch(() => {}),
        ),
      );
    })();

    return () => {
      g.current++;
    };
  }, [uid]);
}
