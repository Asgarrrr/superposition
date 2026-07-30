// src/ui/progressSync.test.ts
import { describe, expect, it } from "vitest";
import { planProgressSync } from "./progressSync.ts";
import { emptyLedger, type Ledger } from "./progression.ts";
import type { TraceStep } from "../engine/types.ts";

const T = (n: number): TraceStep[] =>
  Array.from({ length: n }, () => ({ kind: "move", dir: [0, 1] }) as TraceStep);

// a trace of n moves plus one undo/reset: same winning line, but not clean
const DIRTY = (n: number): TraceStep[] => [...T(n), { kind: "undo" }];

// only the two slices the plan reads; the rest of the ledger is irrelevant here
const L = (
  best: Record<string, number>,
  traces: Record<string, TraceStep[]> = {},
): Ledger => ({ ...emptyLedger, best, traces });

describe("planProgressSync", () => {
  it("downloads a server level the player has never solved locally", () => {
    const plan = planProgressSync(L({}), [{ levelId: "a", moves: 7 }]);
    expect(plan.downloads).toEqual([{ levelId: "a", moves: 7 }]);
    expect(plan.uploads).toEqual([]);
  });

  it("downloads only when the server score is strictly better (min per level)", () => {
    const server = [
      { levelId: "a", moves: 5 }, // better than local 8 → pull
      { levelId: "b", moves: 9 }, // worse than local 4 → skip
      { levelId: "c", moves: 6 }, // equal to local 6 → skip
    ];
    const plan = planProgressSync(
      // b has a trace, but the download side ignores traces
      L({ a: 8, b: 4, c: 6 }, { b: T(4) }),
      server,
    );
    expect(plan.downloads).toEqual([{ levelId: "a", moves: 5 }]);
  });

  it("uploads a clean local record absent from the server", () => {
    const plan = planProgressSync(L({ a: 4 }, { a: T(4) }), []);
    expect(plan.uploads).toEqual([{ levelId: "a", trace: T(4) }]);
  });

  it("uploads a clean local record strictly better than the server's", () => {
    const plan = planProgressSync(L({ a: 3 }, { a: T(3) }), [
      { levelId: "a", moves: 5 },
    ]);
    expect(plan.uploads).toEqual([{ levelId: "a", trace: T(3) }]);
  });

  it("does not upload a level with no stored trace (hinted / traceless)", () => {
    const plan = planProgressSync(L({ a: 4 }), []);
    expect(plan.uploads).toEqual([]);
  });

  it("uploads a clean local record tying the server (may earn the clean seal)", () => {
    // the stored trace is a clean solve; a tie on moves still lets the server's
    // undo tie-break replace a non-clean row, so the upload must fire. The
    // server upsert is a no-op when its row is already clean.
    const plan = planProgressSync(L({ a: 5 }, { a: T(5) }), [
      { levelId: "a", moves: 5 },
    ]);
    expect(plan.uploads).toEqual([{ levelId: "a", trace: T(5) }]);
  });

  it("does not upload a non-clean local trace tying the server (pure no-op)", () => {
    // DIRTY(5) wins in 5 moves but carries a correction; it can never win the
    // undo tie-break, so uploading it would be a wasted round-trip.
    const plan = planProgressSync(L({ a: 5 }, { a: DIRTY(5) }), [
      { levelId: "a", moves: 5 },
    ]);
    expect(plan.uploads).toEqual([]);
  });

  it("does not upload when the server is strictly better", () => {
    const plan = planProgressSync(L({ a: 5 }, { a: T(5) }), [
      { levelId: "a", moves: 3 },
    ]);
    expect(plan.uploads).toEqual([]);
  });

  it("does not upload a trace whose level has no recorded best", () => {
    const plan = planProgressSync(L({}, { a: T(4) }), []);
    expect(plan.uploads).toEqual([]);
  });

  it("plans a download and an upload for different levels in one pass", () => {
    const plan = planProgressSync(
      // a: server 5 beats local 8 → download; b: local 3 clean → upload
      L({ a: 8, b: 3 }, { b: T(3) }),
      [{ levelId: "a", moves: 5 }],
    );
    expect(plan.downloads).toEqual([{ levelId: "a", moves: 5 }]);
    expect(plan.uploads).toEqual([{ levelId: "b", trace: T(3) }]);
  });
});
