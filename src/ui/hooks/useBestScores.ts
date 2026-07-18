// Best scores per level (key = level id), persisted in localStorage.
// `hinted` marks levels cleared with a hint (off the record: no move count),
// so the selector can show they were solved without pretending to a record.

import { useEffect, useState } from "react";

const STORAGE_KEY = "superposition.best";
const HINTED_KEY = "superposition.hinted";

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

  // persistence lives outside the updater: it must stay pure
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  }, [best]);
  useEffect(() => {
    localStorage.setItem(HINTED_KEY, JSON.stringify(hinted));
  }, [hinted]);

  const record = (id: string, moves: number) =>
    setBest((b) => {
      const v = Math.min(b[id] ?? Infinity, moves);
      return v === b[id] ? b : { ...b, [id]: v };
    });

  const markHinted = (id: string) =>
    setHinted((h) => (h[id] ? h : { ...h, [id]: true }));

  return { best, hinted, record, markHinted };
}
