import { describe, expect, it } from "vitest";
import type { Input } from "../engine/types.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import { validateSolution } from "./replay.ts";

// A real, certified level and its optimal solution from the shared engine.
const level = LEVELS[0]; // 'accord'
const solution = solve(level)!.inputs;

describe("validateSolution — server-side replay", () => {
  it("accepts a genuine solution and counts the moves", () => {
    expect(validateSolution(level, solution)).toEqual({
      ok: true,
      moves: solution.length,
    });
  });

  it("rejects an empty sequence", () => {
    expect(validateSolution(level, [])).toEqual({ ok: false, moves: 0 });
  });

  it("rejects a truncated sequence that never wins", () => {
    expect(validateSolution(level, solution.slice(0, -1)).ok).toBe(false);
  });

  it("rejects a sequence containing an illegal move", () => {
    // 'accord' has no fusion mechanic, so a split can never be applied
    const bogus: Input[] = [{ kind: "split", dir: [1, 0] }, ...solution];
    expect(validateSolution(level, bogus).ok).toBe(false);
  });

  it("rejects extra moves after the win", () => {
    const extra: Input[] = [...solution, { kind: "move", dir: [1, 0] }];
    expect(validateSolution(level, extra).ok).toBe(false);
  });

  it("rejects a fabricated direction the engine never produces", () => {
    expect(validateSolution(level, [{ kind: "move", dir: [1, 1] }]).ok).toBe(
      false,
    );
  });
});
