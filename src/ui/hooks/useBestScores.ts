// The progression ledger, held in React and persisted to localStorage. That is
// ALL this does: every rule about what a win changes lives in progression.ts,
// as pure transitions on a value — which is what makes them testable, and what
// removes the mirror-ref this hook used to need to decide "is this a new best?"
// outside setState's timing. A functional update composes them for free.
//
// The four storage keys are unchanged, so an existing player's edition reads
// back exactly as before.

import { useEffect, useState } from "react";
import {
  markHinted as markHintedIn,
  recordWin,
  type Ledger,
  type Win,
} from "../progression.ts";

const KEYS = {
  best: "superposition.best",
  hinted: "superposition.hinted",
  clean: "superposition.clean",
  traces: "superposition.traces",
} as const;

function load<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

function loadLedger(): Ledger {
  return {
    best: load<number>(KEYS.best),
    hinted: load<true>(KEYS.hinted),
    clean: load<true>(KEYS.clean),
    traces: load<Ledger["traces"][string]>(KEYS.traces),
  };
}

export function useBestScores() {
  const [ledger, setLedger] = useState<Ledger>(loadLedger);

  // persistence lives outside the transitions: those must stay pure
  useEffect(() => {
    try {
      for (const [slice, key] of Object.entries(KEYS))
        localStorage.setItem(
          key,
          JSON.stringify(ledger[slice as keyof Ledger]),
        );
    } catch {
      // storage unavailable (private browsing): degrade to in-memory only
    }
  }, [ledger]);

  return {
    ledger,
    record: (win: Win) => setLedger((l) => recordWin(l, win)),
    markHinted: (levelId: string) => setLedger((l) => markHintedIn(l, levelId)),
  };
}
