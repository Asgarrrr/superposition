// Best scores per level (key = level id), persisted in localStorage.
// `hinted` marks levels cleared with a hint (off the record: no move count),
// so the selector can show they were solved without pretending to a record.
// `clean` marks levels ever cleared with no correction (no undo, no reset) —
// sticky once earned, it backs the "sans retouche" stamp.

import { useEffect, useState } from "react";

const STORAGE_KEY = "superposition.best";
const HINTED_KEY = "superposition.hinted";
const CLEAN_KEY = "superposition.clean";

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

  // a win updates the best as ever; a clean win (no correction) also raises the
  // sticky "sans retouche" flag — once earned it never clears
  const record = (id: string, moves: number, clean: boolean) => {
    setBest((b) => {
      const v = Math.min(b[id] ?? Infinity, moves);
      return v === b[id] ? b : { ...b, [id]: v };
    });
    if (clean) setClean((c) => (c[id] ? c : { ...c, [id]: true }));
  };

  const markHinted = (id: string) =>
    setHinted((h) => (h[id] ? h : { ...h, [id]: true }));

  return { best, hinted, clean, record, markHinted };
}
