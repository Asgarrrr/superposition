import { describe, expect, it } from "vitest";
import type { Input, TraceStep } from "../engine/types.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import { validateSolution, validateTrace } from "./replay.ts";

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

describe("validateTrace — clean-solve detection", () => {
  it("counts a straight solution as a clean solve (0 corrections)", () => {
    expect(validateTrace(level, solution)).toEqual({
      ok: true,
      moves: solution.length,
      corrections: 0,
    });
  });

  it("counts undos and still derives the winning move count", () => {
    // play the first move, undo it, then play the real solution
    const trace: TraceStep[] = [solution[0], { kind: "undo" }, ...solution];
    expect(validateTrace(level, trace)).toEqual({
      ok: true,
      moves: solution.length,
      corrections: 1,
    });
  });

  it("counts a reset that discarded progress", () => {
    const trace: TraceStep[] = [
      solution[0],
      solution[1],
      { kind: "reset" },
      ...solution,
    ];
    expect(validateTrace(level, trace)).toEqual({
      ok: true,
      moves: solution.length,
      corrections: 1,
    });
  });

  it("ignores an undo at the initial state (nothing to pop)", () => {
    const trace: TraceStep[] = [{ kind: "undo" }, ...solution];
    // the undo is still a correction, but the stack floor holds and it wins
    expect(validateTrace(level, trace)).toEqual({
      ok: true,
      moves: solution.length,
      corrections: 1,
    });
  });

  it("rejects a trace whose final state does not win", () => {
    expect(validateTrace(level, solution.slice(0, -1)).ok).toBe(false);
  });

  it("rejects a trace containing an illegal move", () => {
    const bogus: TraceStep[] = [{ kind: "split", dir: [1, 0] }, ...solution];
    expect(validateTrace(level, bogus).ok).toBe(false);
  });
});
