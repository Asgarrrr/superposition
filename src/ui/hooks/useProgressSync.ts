// src/ui/hooks/useProgressSync.ts
// At the moment the session resolves to a signed-in user, reconcile the local
// progression ledger with the server: offer it every stored row (it applies its
// own rules — min for the record, sticky for the clean seal), and replay-submit
// the local clean records worth sending. Keyed on the user id (session is a
// fresh object each render), so it runs once per account change; a genuine
// remount re-runs it, which is safe — both halves are idempotent. The mutating
// deps are read through a ref (as LeaderboardRail does for submit).

import { useEffect, useRef } from "react";
import { getMyLevelScores, submitLevelScore } from "../../server/campaign.ts";
import { asWin, planUploads } from "../progressSync.ts";
import type { Ledger, Win } from "../progression.ts";

interface Deps {
  ledger: Ledger;
  record: (win: Win) => void;
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
      const { ledger, record } = depsRef.current;
      const uploads = planUploads(ledger, server);
      // Offer every row: the ledger keeps the better record and raises the
      // sticky clean seal, and a row that changes nothing returns the same
      // object, so this costs a reference comparison. No trace is sent — the
      // ledger drops any stale one, since it would no longer match the record.
      //
      // A row seals only when the STORED BEST was clean. A player whose clean
      // run was not their best row keeps their seal locally but cannot recover
      // it on a new device: the server holds one row per level, not a history,
      // so "ever solved cleanly" is not a fact it has.
      for (const s of server) record(asWin(s));
      // independent per-level upserts: fire together rather than serializing N
      // round-trips. A stale/invalid trace must not break the others — swallow
      // per-upload.
      await Promise.all(
        uploads.map((u) =>
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
