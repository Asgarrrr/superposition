import { describe, expect, it } from "vitest";
import { LEVELS } from "../engine/levels.ts";
import { hashState, initialState, isWin } from "../engine/state.ts";
import { applyInput, successors } from "../engine/successors.ts";
import { solve, solveFrom } from "./bfs.ts";

// The hint feature asks the solver for the next optimal move from wherever the
// player currently stands. This certifies that `solveFrom` does exactly that on
// real bank levels: from a state part-way down an optimal line, its answer is
// itself optimal (its length equals the remaining distance) and its first move
// stays on an optimal path (the distance drops by exactly one).
describe("solveFrom — next optimal move from an intermediate state", () => {
  // a plain level and a mechanic-heavy one, so the property isn't rule-specific
  for (const id of ["croisee", "blanc"]) {
    it(`${id}: an intermediate state keeps optimal distance`, () => {
      const level = LEVELS.find((l) => l.id === id)!;
      const full = solve(level);
      expect(full).not.toBeNull();
      const len = full!.inputs.length;
      expect(len).toBeGreaterThan(2); // a meaningful mid-point exists

      // walk to roughly the middle of one optimal solution
      const k = Math.floor(len / 2);
      let mid = initialState(level);
      for (let i = 0; i < k; i++) {
        const next = applyInput(mid, level, full!.inputs[i]);
        expect(next).not.toBeNull();
        mid = next!;
      }
      expect(isWin(mid, level)).toBe(false);

      // the remaining optimal distance from mid is exactly what's left
      const rest = solveFrom(level, mid);
      expect(rest).not.toBeNull();
      expect(rest!.inputs.length).toBe(len - k);

      // and the suggested first move is on an optimal path: taking it drops the
      // distance by one
      const after = applyInput(mid, level, rest!.inputs[0]);
      expect(after).not.toBeNull();
      expect(solveFrom(level, after!)!.inputs.length).toBe(len - k - 1);
    });
  }

  // The hint's honest no-op (useGame.showHint): from a dead end — a state a bad
  // merge stranded, with no line left to the goal — solveFrom returns null, and
  // the UI says so plainly instead of silently doing nothing. Certify that such
  // reachable dead ends exist and that solveFrom reports them as null.
  it("reports null from reachable dead-end states", () => {
    const level = LEVELS[0];
    const start = initialState(level);
    const seen = new Map([[hashState(start, level), start]]);
    const stack = [start];
    while (stack.length) {
      for (const [, ns] of successors(stack.pop()!, level)) {
        const h = hashState(ns, level);
        if (!seen.has(h)) {
          seen.set(h, ns);
          stack.push(ns);
        }
      }
    }
    const deadEnds = [...seen.values()].filter(
      (s) => !isWin(s, level) && solveFrom(level, s) === null,
    );
    expect(deadEnds.length).toBeGreaterThan(0);
  });

  it("returns an empty solution on an already-won state", () => {
    const level = LEVELS[0];
    const won = solve(level)!.inputs.reduce(
      (s, inp) => applyInput(s, level, inp)!,
      initialState(level),
    );
    expect(isWin(won, level)).toBe(true);
    expect(solveFrom(level, won)).toEqual({ inputs: [] });
  });
});
