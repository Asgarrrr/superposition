// Anti-cheat: the client submits its full play trace; the server replays it
// through the pure engine to decide whether it truly wins, how many moves it
// took, and how many corrections (undo/reset) it used. The server trusts
// nothing the client says about its score. Pure and framework-free so it can be
// unit-tested directly (see replay.test.ts).

import type { GameState, Level, TraceStep } from "../engine/types.ts";
import { initialState, isWin } from "../engine/state.ts";
import { applyInput } from "../engine/successors.ts";

/** Shape-check one applied input (known kind + numeric [row, col] direction).
 * Shared by every submitted-shape validator; throws on the first malformation. */
function assertValidInput(step: { kind?: unknown; dir?: unknown }): void {
  if (step.kind !== "move" && step.kind !== "split" && step.kind !== "shift")
    throw new Error("invalid input kind");
  const dir = step.dir;
  if (
    !Array.isArray(dir) ||
    dir.length !== 2 ||
    typeof dir[0] !== "number" ||
    typeof dir[1] !== "number"
  )
    throw new Error("invalid input direction");
}

// Hard ceiling on submitted length: a raw trace carries corrections (undo/reset)
// so it runs longer than a clean solution, but no honest play is near this long
// and it bounds replay work per request.
export const MAX_TRACE = 2000;

export interface TraceResult {
  ok: boolean;
  moves: number; // length of the final winning line (corrections don't count)
  corrections: number; // undos + resets used to reach it (0 = clean solve)
}

const TRACE_REJECT: TraceResult = { ok: false, moves: 0, corrections: 0 };

/**
 * Replays a full play trace on a state stack: an input pushes, an undo pops, a
 * reset returns to the initial state. Accepts only a trace whose FINAL state
 * wins. Returns the winning line's move count and the number of corrections —
 * so the server, not the client, decides whether a solve was clean.
 */
export function validateTrace(level: Level, trace: TraceStep[]): TraceResult {
  if (!Array.isArray(trace) || trace.length === 0 || trace.length > MAX_TRACE)
    return TRACE_REJECT;

  const stack: GameState[] = [initialState(level)];
  let corrections = 0;
  for (const step of trace) {
    if (step.kind === "undo") {
      if (stack.length > 1) stack.pop();
      corrections++;
      continue;
    }
    if (step.kind === "reset") {
      stack.length = 1; // back to the initial state
      corrections++;
      continue;
    }
    const next = applyInput(stack[stack.length - 1], level, step);
    if (!next) return TRACE_REJECT; // illegal / impossible move
    stack.push(next);
  }

  if (!isWin(stack[stack.length - 1], level)) return TRACE_REJECT;
  return { ok: true, moves: stack.length - 1, corrections };
}

/**
 * Structural validation of a submitted trace: an array of at most MAX_TRACE
 * steps, each a control token (undo/reset) or a well-formed input. Throws on
 * the first malformation; does NOT check that the trace wins.
 */
export function validateTraceShape(trace: unknown): TraceStep[] {
  if (!Array.isArray(trace)) throw new Error("trace must be an array");
  if (trace.length > MAX_TRACE) throw new Error("trace too long");
  for (const s of trace as Array<{ kind?: unknown; dir?: unknown }>) {
    if (!s) throw new Error("invalid trace step");
    if (s.kind === "undo" || s.kind === "reset") continue;
    assertValidInput(s);
  }
  return trace as TraceStep[];
}
