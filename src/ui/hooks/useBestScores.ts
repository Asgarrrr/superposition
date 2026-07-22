// Best scores per level (key = level id), persisted in localStorage.
// `hinted` marks levels cleared with a hint (off the record: no move count),
// so the selector can show they were solved without pretending to a record.
// `traces` keeps the winning trace of each level's best CLEAN solve, so a
// signed-in player can replay-submit it (see progressSync / useProgressSync).

import { useEffect, useState } from "react";
import type { TraceStep } from "../../engine/types.ts";

const STORAGE_KEY = "superposition.best";
const HINTED_KEY = "superposition.hinted";
const TRACES_KEY = "superposition.traces";

function load<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

export function useBestScores() {
  const [best, setBest] = useState<Record<string, number>>(() =>
    load<number>(STORAGE_KEY),
  );
  const [hinted, setHinted] = useState<Record<string, true>>(() =>
    load<true>(HINTED_KEY),
  );
  const [traces, setTraces] = useState<Record<string, TraceStep[]>>(() =>
    load<TraceStep[]>(TRACES_KEY),
  );

  // persistence lives outside the updater: it must stay pure
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  }, [best]);
  useEffect(() => {
    localStorage.setItem(HINTED_KEY, JSON.stringify(hinted));
  }, [hinted]);
  useEffect(() => {
    localStorage.setItem(TRACES_KEY, JSON.stringify(traces));
  }, [traces]);

  // A clean win passes its trace; a downward sync (record from the server) omits
  // it. The trace is kept only when this solve becomes the new best, so a worse
  // replay never overwrites the better line. The "is this a new best?" decision
  // is made inside the functional updater — against fresh state, never a stale
  // render closure — and read back synchronously to gate the trace write.
  const record = (id: string, moves: number, trace?: TraceStep[]) => {
    let isBest = false;
    setBest((b) => {
      const prev = b[id];
      isBest = prev === undefined || moves < prev;
      return isBest ? { ...b, [id]: moves } : b;
    });
    if (trace && isBest) {
      setTraces((t) => ({ ...t, [id]: trace }));
    }
  };

  const markHinted = (id: string) =>
    setHinted((h) => (h[id] ? h : { ...h, [id]: true }));

  return { best, hinted, traces, record, markHinted };
}
