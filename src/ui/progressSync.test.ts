// src/ui/progressSync.test.ts
// Which local records are worth replaying to the server. The downward half is
// no longer planned here — the ledger applies its own new-best and clean rules,
// pinned in progression.test.ts — so this covers uploads only.

import { describe, expect, it } from "vitest";
import { asWin, planUploads, type ServerScore } from "./progressSync.ts";
import { emptyLedger, plate, recordWin, type Ledger } from "./progression.ts";
import type { TraceStep } from "../engine/types.ts";

const T = (n: number): TraceStep[] =>
  Array.from({ length: n }, () => ({ kind: "move", dir: [0, 1] }) as TraceStep);

// a trace of n moves plus one undo: same winning line, but not clean
const DIRTY = (n: number): TraceStep[] => [...T(n), { kind: "undo" }];

// only the two slices the plan reads; the rest of the ledger is irrelevant here
const L = (
  best: Record<string, number>,
  traces: Record<string, TraceStep[]> = {},
): Ledger => ({ ...emptyLedger, best, traces });

// `undos` and `everClean` are irrelevant to the upload decision (the server
// re-derives the corrections from the trace we send), so the rows here carry
// plain defaults
const remote = (levelId: string, moves: number): ServerScore => ({
  levelId,
  moves,
  undos: 0,
  everClean: false,
});

describe("planUploads", () => {
  it("uploads a clean local record absent from the server", () => {
    expect(planUploads(L({ a: 4 }, { a: T(4) }), [])).toEqual([
      { levelId: "a", trace: T(4) },
    ]);
  });

  it("uploads a clean local record strictly better than the server's", () => {
    expect(planUploads(L({ a: 3 }, { a: T(3) }), [remote("a", 5)])).toEqual([
      { levelId: "a", trace: T(3) },
    ]);
  });

  it("does not upload a level with no stored trace (hinted / traceless)", () => {
    expect(planUploads(L({ a: 4 }), [])).toEqual([]);
  });

  it("uploads a clean local record tying the server (may earn the clean seal)", () => {
    // a tie on moves still lets the server's undo tie-break replace a non-clean
    // row, so the upload must fire. The upsert is a no-op if its row is clean.
    expect(planUploads(L({ a: 5 }, { a: T(5) }), [remote("a", 5)])).toEqual([
      { levelId: "a", trace: T(5) },
    ]);
  });

  it("does not upload a non-clean local trace tying the server (pure no-op)", () => {
    // DIRTY(5) wins in 5 moves but carries a correction; it can never win the
    // undo tie-break, so uploading it would be a wasted round-trip.
    expect(planUploads(L({ a: 5 }, { a: DIRTY(5) }), [remote("a", 5)])).toEqual(
      [],
    );
  });

  it("does not upload when the server is strictly better", () => {
    expect(planUploads(L({ a: 5 }, { a: T(5) }), [remote("a", 3)])).toEqual([]);
  });

  it("does not upload a trace whose level has no recorded best", () => {
    expect(planUploads(L({}, { a: T(4) }), [])).toEqual([]);
  });

  it("weighs each level on its own", () => {
    const plan = planUploads(
      // a: the server is ahead → nothing; b: local is ahead and clean → upload
      L({ a: 8, b: 3 }, { a: T(8), b: T(3) }),
      [remote("a", 5)],
    );
    expect(plan).toEqual([{ levelId: "b", trace: T(3) }]);
  });
});

describe("asWin — a stored row offered to the ledger", () => {
  it("carries the record and seals a level ever solved cleanly", () => {
    expect(
      asWin({ levelId: "a", moves: 4, undos: 0, everClean: true }),
    ).toEqual({
      levelId: "a",
      moves: 4,
      clean: true,
    });
  });

  it("does not seal a level never solved cleanly", () => {
    expect(
      asWin({ levelId: "a", moves: 4, undos: 2, everClean: false }),
    ).toMatchObject({ clean: false });
  });

  it("seals on the level's history, not on the stored row's corrections", () => {
    // THE gap this column closes: the clean run was not the best row, so the
    // stored best carries corrections — the seal must come from `everClean`
    expect(
      asWin({ levelId: "a", moves: 4, undos: 2, everClean: true }),
    ).toMatchObject({ clean: true });
  });

  it("withholds the seal from a clean-looking row the server never marked", () => {
    // the mirror case: `undos === 0` is the boards' rule, not progression's.
    // Reading it here would resurrect the old spelling behind the new column.
    expect(
      asWin({ levelId: "a", moves: 4, undos: 0, everClean: false }),
    ).toMatchObject({ clean: false });
  });

  it("carries no trace — the ledger drops any that no longer fits", () => {
    expect(
      asWin({ levelId: "a", moves: 4, undos: 0, everClean: true }).trace,
    ).toBeUndefined();
  });

  it("restores records and seals when folded over a fresh ledger", () => {
    // the new-device path: an empty ledger, every stored row offered to it
    const server: ServerScore[] = [
      { levelId: "accord", moves: 4, undos: 0, everClean: true },
      { levelId: "retenue", moves: 9, undos: 3, everClean: false },
    ];
    const restored = server.reduce(
      (acc, s) => recordWin(acc, asWin(s)),
      emptyLedger,
    );
    expect(plate(restored, "accord")).toMatchObject({ record: 4, sans: true });
    expect(plate(restored, "retenue")).toMatchObject({
      record: 9,
      sans: false,
    });
  });

  it("leaves a better local record alone while still raising its seal", () => {
    // partial local progress: the ledger's own min rule keeps the local 3, and
    // the seal rises anyway because it is sticky and ungated
    const local = recordWin(emptyLedger, { levelId: "accord", moves: 3 });
    const merged = recordWin(
      local,
      asWin({ levelId: "accord", moves: 5, undos: 0, everClean: true }),
    );
    expect(plate(merged, "accord")).toMatchObject({ record: 3, sans: true });
  });

  it("costs nothing when the row tells the ledger nothing new", () => {
    const l = recordWin(emptyLedger, { levelId: "accord", moves: 4 });
    // same reference back: React bails out, no render
    expect(
      recordWin(
        l,
        asWin({ levelId: "accord", moves: 9, undos: 1, everClean: false }),
      ),
    ).toBe(l);
  });
});
