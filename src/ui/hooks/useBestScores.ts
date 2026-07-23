// Best scores per level (key = level id), persisted in localStorage.
// `hinted` marks levels cleared with a hint (off the record: no move count),
// so the selector can show they were solved without pretending to a record.
// `clean` marks levels ever cleared with no correction (no undo, no reset) —
// sticky once earned, it backs the "sans retouche" stamp.
// `traces` keeps the winning trace of each level's best CLEAN solve, so a
// signed-in player can replay-submit it (see progressSync / useProgressSync).

import { useEffect, useRef, useState } from "react";
import type { TraceStep } from "../../engine/types.ts";

const STORAGE_KEY = "superposition.best";
const HINTED_KEY = "superposition.hinted";
const CLEAN_KEY = "superposition.clean";
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
  const [clean, setClean] = useState<Record<string, true>>(() =>
    load<true>(CLEAN_KEY),
  );
  const [traces, setTraces] = useState<Record<string, TraceStep[]>>(() =>
    load<TraceStep[]>(TRACES_KEY),
  );
  // latest committed `best`, mirrored into a ref so `record` can decide "is this
  // a new best?" without riding on setState timing (React runs an updater
  // synchronously at dispatch only via its eager-bailout path). Advanced
  // in-place per record so several records in one tick stay consistent.
  const bestRef = useRef(best);
  bestRef.current = best;

  // persistence lives outside the updater: it must stay pure
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  }, [best]);
  useEffect(() => {
    localStorage.setItem(HINTED_KEY, JSON.stringify(hinted));
  }, [hinted]);
  useEffect(() => {
    localStorage.setItem(CLEAN_KEY, JSON.stringify(clean));
  }, [clean]);
  useEffect(() => {
    localStorage.setItem(TRACES_KEY, JSON.stringify(traces));
  }, [traces]);

  // A clean win passes its trace; a downward sync (record from the server) omits
  // it. The sticky "sans retouche" flag rises on any correction-free win, best
  // or not, so it stays outside the new-best gate. The trace, by contrast, is
  // kept only for the CURRENT best so it and `best` never disagree: a new clean
  // best stores its trace, a new best pulled from the server (no trace) drops
  // any now-stale trace, and a worse replay changes nothing. "Is this a new
  // best?" is decided against the ref mirror of `best`, not a flag mutated
  // inside the updater, so it never depends on setState timing.
  const record = (
    id: string,
    moves: number,
    trace?: TraceStep[],
    isClean?: boolean,
  ) => {
    if (isClean) setClean((c) => (c[id] ? c : { ...c, [id]: true }));

    const prev = bestRef.current[id];
    if (prev !== undefined && moves >= prev) return;
    bestRef.current = { ...bestRef.current, [id]: moves };
    setBest((b) => ({ ...b, [id]: moves }));
    if (trace) {
      setTraces((t) => ({ ...t, [id]: trace }));
    } else {
      setTraces((t) => {
        if (!(id in t)) return t;
        const next = { ...t };
        delete next[id];
        return next;
      });
    }
  };

  const markHinted = (id: string) =>
    setHinted((h) => (h[id] ? h : { ...h, [id]: true }));

  return { best, hinted, clean, traces, record, markHinted };
}
