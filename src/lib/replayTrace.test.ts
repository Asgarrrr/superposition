import { describe, expect, it } from "vitest";
import type { Input, TraceStep } from "../engine/types.ts";
import { LEVELS } from "../engine/levels.ts";
import { solve } from "../solver/bfs.ts";
import {
  decodeTrace,
  encodeTrace,
  MAX_REPLAY_STEPS,
  winningLine,
} from "./replayTrace.ts";

const line = solve(LEVELS[0])!.inputs;

describe("encodeTrace / decodeTrace — round trip", () => {
  it("round-trips a real solution line", () => {
    expect(decodeTrace(encodeTrace(line))).toEqual(line);
  });

  it("covers every kind and direction", () => {
    const all: Input[] = [
      { kind: "move", dir: [-1, 0] },
      { kind: "move", dir: [1, 0] },
      { kind: "move", dir: [0, -1] },
      { kind: "move", dir: [0, 1] },
      { kind: "split", dir: [-1, 0] },
      { kind: "split", dir: [0, 1] },
      { kind: "shift", dir: [1, 0] },
      { kind: "shift", dir: [0, -1] },
    ];
    const s = encodeTrace(all);
    expect(s).toHaveLength(all.length);
    expect(decodeTrace(s)).toEqual(all);
  });
});

describe("decodeTrace — boundary rejection", () => {
  it("rejects the empty string", () => {
    expect(decodeTrace("")).toBeNull();
  });

  it("rejects an unknown symbol", () => {
    expect(decodeTrace("abZ")).toBeNull();
  });

  it("rejects an over-long token string", () => {
    expect(decodeTrace("a".repeat(MAX_REPLAY_STEPS + 1))).toBeNull();
  });
});

describe("winningLine — collapses corrections", () => {
  it("pops the last input on undo", () => {
    const trace: TraceStep[] = [line[0], line[1], { kind: "undo" }, line[1]];
    expect(winningLine(trace)).toEqual([line[0], line[1]]);
  });

  it("clears the line on reset", () => {
    const trace: TraceStep[] = [line[0], { kind: "reset" }, ...line];
    expect(winningLine(trace)).toEqual(line);
  });

  it("a clean trace is its own winning line", () => {
    expect(winningLine([...line])).toEqual(line);
  });
});
