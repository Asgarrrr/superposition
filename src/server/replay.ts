// Anti-cheat: the client submits its winning input sequence; the server replays
// it through the pure engine to decide whether it truly wins and how many moves
// it took. The server trusts nothing the client says about its score. Pure and
// framework-free so it can be unit-tested directly (see replay.test.ts).

import type { GameState, Input, Level, TraceStep } from "../engine/types.ts";
import { initialState, isWin } from "../engine/state.ts";
import { applyInput } from "../engine/successors.ts";

export interface ReplayResult {
  ok: boolean;
  moves: number;
}

// Hard ceiling on submitted length: no honest size-5 solution is near this long,
// and it bounds replay work per request.
export const MAX_INPUTS = 500;

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

/**
 * Structural validation of a submitted input list, shared by every score
 * endpoint: an array of at most MAX_INPUTS well-formed inputs. Bounds work
 * before the replay loop and throws on the first malformation. Does NOT check
 * that the sequence wins — that's validateSolution's job.
 */
export function validateInputsShape(inputs: unknown): Input[] {
  if (!Array.isArray(inputs)) throw new Error("inputs must be an array");
  if (inputs.length > MAX_INPUTS) throw new Error("too many inputs");
  for (const it of inputs as Array<{ kind?: unknown; dir?: unknown }>) {
    if (!it) throw new Error("invalid input");
    assertValidInput(it);
  }
  return inputs as Input[];
}

const REJECT: ReplayResult = { ok: false, moves: 0 };

/**
 * Replays `inputs` from the level's initial state. Accepts only a clean
 * solution: every input legal, the win reached on the LAST input and not
 * before. Returns the move count (= inputs.length) when accepted.
 */
export function validateSolution(level: Level, inputs: Input[]): ReplayResult {
  if (
    !Array.isArray(inputs) ||
    inputs.length === 0 ||
    inputs.length > MAX_INPUTS
  )
    return REJECT;

  let state = initialState(level);
  for (let i = 0; i < inputs.length; i++) {
    const next = applyInput(state, level, inputs[i]);
    if (!next) return REJECT; // illegal / impossible move
    state = next;
    const won = isWin(state, level);
    const last = i === inputs.length - 1;
    if (won !== last) return REJECT; // won early, or ended without winning
  }
  return { ok: true, moves: inputs.length };
}

// A raw trace carries corrections (undo/reset), so it runs longer than a clean
// solution — a looser ceiling than MAX_INPUTS, still bounding replay work.
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
