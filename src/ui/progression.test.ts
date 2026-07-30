// The ledger's rules. These lived inside useBestScores, where no test could
// reach them — the new-best gate, the trace-keeping rule that ties a trace to
// the record it belongs to, and the sticky clean flag that must survive a worse
// replay. The stamp derivation (formerly stamps.ts) is here too, since it is
// the same ledger answering a different question.

import { describe, expect, it } from "vitest";
import type { TraceStep } from "../engine/types.ts";
import { PAR } from "../engine/par.ts";
import { LEVELS } from "../engine/levels.ts";
import {
  atPar,
  emptyLedger,
  markHinted,
  plate,
  recordWin,
  setPulled,
  type Ledger,
} from "./progression.ts";

const T = (n: number): TraceStep[] =>
  Array.from({ length: n }, () => ({ kind: "move", dir: [0, 1] }) as TraceStep);

describe("recordWin — the record", () => {
  it("puts a first win on the record", () => {
    const l = recordWin(emptyLedger, { levelId: "a", moves: 7 });
    expect(plate(l, "a").record).toBe(7);
  });

  it("keeps the better of two wins, whichever order they land in", () => {
    let l = recordWin(emptyLedger, { levelId: "a", moves: 7 });
    l = recordWin(l, { levelId: "a", moves: 9 });
    expect(plate(l, "a").record).toBe(7);
    l = recordWin(l, { levelId: "a", moves: 5 });
    expect(plate(l, "a").record).toBe(5);
  });

  it("composes several wins landing in one tick", () => {
    // this is what the hook's mirror-ref used to buy; a pure transition
    // applied through a functional setState gets it for free
    const l = [9, 6, 8, 5].reduce(
      (acc, moves) => recordWin(acc, { levelId: "a", moves }),
      emptyLedger,
    );
    expect(plate(l, "a").record).toBe(5);
  });

  it("does not treat an equal result as an improvement", () => {
    const first = recordWin(emptyLedger, {
      levelId: "a",
      moves: 7,
      trace: T(7),
    });
    const again = recordWin(first, { levelId: "a", moves: 7, trace: T(3) });
    expect(again.traces.a).toHaveLength(7);
  });
});

describe("recordWin — the trace follows the record", () => {
  it("stores the trace of a new best", () => {
    const l = recordWin(emptyLedger, { levelId: "a", moves: 4, trace: T(4) });
    expect(l.traces.a).toHaveLength(4);
  });

  it("drops a stale trace when a better, traceless best arrives", () => {
    // the server pull path: it knows the move count but carries no trace, and
    // leaving the old one would have the ledger claim a trace for a record it
    // does not belong to
    let l = recordWin(emptyLedger, { levelId: "a", moves: 6, trace: T(6) });
    l = recordWin(l, { levelId: "a", moves: 4 });
    expect(plate(l, "a").record).toBe(4);
    expect(l.traces.a).toBeUndefined();
  });

  it("leaves the stored trace alone when a worse replay lands", () => {
    let l = recordWin(emptyLedger, { levelId: "a", moves: 4, trace: T(4) });
    l = recordWin(l, { levelId: "a", moves: 9, trace: T(9) });
    expect(l.traces.a).toHaveLength(4);
  });
});

describe("recordWin — the clean flag is sticky and ungated", () => {
  it("rises on a correction-free win that is NOT a new best", () => {
    let l = recordWin(emptyLedger, { levelId: "a", moves: 4 });
    l = recordWin(l, { levelId: "a", moves: 9, clean: true });
    expect(plate(l, "a").sans).toBe(true);
    expect(plate(l, "a").record).toBe(4); // …without touching the record
  });

  it("survives a later win that used corrections", () => {
    let l = recordWin(emptyLedger, { levelId: "a", moves: 9, clean: true });
    l = recordWin(l, { levelId: "a", moves: 4, clean: false });
    expect(plate(l, "a").sans).toBe(true);
  });
});

describe("markHinted", () => {
  it("marks a level solved off the record", () => {
    const l = markHinted(emptyLedger, "a");
    expect(plate(l, "a").hinted).toBe(true);
    expect(plate(l, "a").record).toBeUndefined();
  });

  it("returns the same ledger when nothing changes", () => {
    const once = markHinted(emptyLedger, "a");
    expect(markHinted(once, "a")).toBe(once);
  });
});

describe("atPar — bon à tirer", () => {
  it("is earned at the solver's optimum and not above it", () => {
    expect(atPar("accord", PAR.accord)).toBe(true);
    expect(atPar("accord", PAR.accord + 1)).toBe(false);
  });

  it("is never earned without a record, or by an id with no par", () => {
    expect(atPar("accord", undefined)).toBe(false);
    expect(atPar("inconnu", 1)).toBe(false);
  });
});

describe("plate — the stamps", () => {
  it("reads bat off the record and sans off the clean ledger", () => {
    const l: Ledger = {
      ...emptyLedger,
      best: { accord: PAR.accord },
      clean: { accord: true },
    };
    expect(plate(l, "accord")).toMatchObject({ bat: true, sans: true });
  });

  it("keeps the two stamps independent", () => {
    const l: Ledger = {
      ...emptyLedger,
      best: { accord: PAR.accord + 3 },
      clean: { accord: true },
    };
    expect(plate(l, "accord")).toMatchObject({ bat: false, sans: true });
  });

  it("is safe on an unknown id", () => {
    expect(plate(emptyLedger, "inconnu")).toEqual({
      record: undefined,
      hinted: false,
      bat: false,
      sans: false,
    });
  });
});

describe("setPulled", () => {
  const chapter = LEVELS[0].ch;
  const ofChapter = LEVELS.filter((lv) => lv.ch === chapter);

  it("is false while one plate of the set is missing", () => {
    const best = Object.fromEntries(
      ofChapter.slice(0, -1).map((lv) => [lv.id, 1]),
    );
    expect(setPulled({ ...emptyLedger, best }, chapter)).toBe(false);
  });

  it("is true once every plate of the set is on the record", () => {
    const best = Object.fromEntries(ofChapter.map((lv) => [lv.id, 1]));
    expect(setPulled({ ...emptyLedger, best }, chapter)).toBe(true);
  });

  it("is false for a chapter with no plates — nothing to have pulled", () => {
    expect(setPulled(emptyLedger, "chapitre-inexistant")).toBe(false);
  });
});
