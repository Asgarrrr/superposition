// src/ui/progressSync.test.ts
import { describe, expect, it } from "vitest";
import { planProgressSync } from "./progressSync.ts";
import type { TraceStep } from "../engine/types.ts";

const T = (n: number): TraceStep[] =>
  Array.from({ length: n }, () => ({ kind: "move", dir: [0, 1] }) as TraceStep);

describe("planProgressSync", () => {
  it("downloads a server level the player has never solved locally", () => {
    const plan = planProgressSync({}, {}, [{ levelId: "a", moves: 7 }]);
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
      { a: 8, b: 4, c: 6 },
      { b: T(4) }, // b has a trace, but download side ignores traces
      server,
    );
    expect(plan.downloads).toEqual([{ levelId: "a", moves: 5 }]);
  });

  it("uploads a clean local record absent from the server", () => {
    const plan = planProgressSync({ a: 4 }, { a: T(4) }, []);
    expect(plan.uploads).toEqual([{ levelId: "a", trace: T(4) }]);
  });

  it("uploads a clean local record strictly better than the server's", () => {
    const plan = planProgressSync({ a: 3 }, { a: T(3) }, [
      { levelId: "a", moves: 5 },
    ]);
    expect(plan.uploads).toEqual([{ levelId: "a", trace: T(3) }]);
  });

  it("does not upload a level with no stored trace (hinted / traceless)", () => {
    const plan = planProgressSync({ a: 4 }, {}, []);
    expect(plan.uploads).toEqual([]);
  });

  it("does not upload when the server is equal or better", () => {
    const plan = planProgressSync({ a: 5 }, { a: T(5) }, [
      { levelId: "a", moves: 5 },
    ]);
    expect(plan.uploads).toEqual([]);
  });
});
