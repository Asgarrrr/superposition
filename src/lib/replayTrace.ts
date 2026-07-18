// Compact URL encoding of a replay's winning line, shared by the client (which
// builds the share URL) and the server (which decodes it before replaying it
// through the engine). Pure and framework-free — imports only engine geometry —
// so it stays out of nothing and can be unit-tested directly.

import type { Input, Pos, TraceStep } from "../engine/types.ts";
import { DIRS, eq } from "../engine/grid.ts";

const KINDS: Input["kind"][] = ["move", "split", "shift"];

// One char per step: token = kind * 4 + dirIndex, mapped into a 12-symbol,
// URL-path-safe alphabet (3 kinds × 4 directions). Opaque but tiny — a 40-move
// solution is 40 chars.
const ALPHABET = "abcdefghijkl";

// Hard ceiling on a replayable line: the bank's solutions run well under this,
// so it both bounds the URL and the per-request replay/render work. Corrections
// are collapsed away before encoding, so this is the clean move count.
export const MAX_REPLAY_STEPS = 60;

const dirIndex = (dir: Pos): number => DIRS.findIndex((d) => eq(d, dir));

/**
 * Folds a raw play trace into a stack under the correction rules: a plain input
 * pushes, `undo` pops (never past the seed floor), `reset` clears back to the
 * seed. `push` maps the current top and the input to the next value, or returns
 * null to abort the whole fold (an illegal move) — so an illegal input
 * invalidates the trace even if a later undo would have removed it. Returns the
 * final stack (seed first) and the number of corrections spent, or null on an
 * aborted push. The single owner of the undo/reset collapse, shared by the
 * winning-line extractor (client) and the anti-cheat's state stack (server).
 */
export function foldTrace<T>(
  seed: T[],
  trace: TraceStep[],
  push: (top: T, step: Input) => T | null,
): { stack: T[]; corrections: number } | null {
  const stack = [...seed];
  const floor = seed.length;
  let corrections = 0;
  for (const step of trace) {
    if (step.kind === "undo") {
      if (stack.length > floor) stack.pop();
      corrections++;
    } else if (step.kind === "reset") {
      stack.length = floor;
      corrections++;
    } else {
      const next = push(stack[stack.length - 1], step);
      if (next === null) return null;
      stack.push(next);
    }
  }
  return { stack, corrections };
}

/** The winning line of a raw play trace: corrections resolved away (undo pops
 *  the last input, reset clears), leaving exactly the inputs that reach the
 *  win — the same collapse the anti-cheat's state stack performs, on inputs. */
export function winningLine(trace: TraceStep[]): Input[] {
  // push never fails here (inputs aren't engine-validated at this stage), so the
  // fold never aborts — the non-null assertion is total.
  return foldTrace<Input>([], trace, (_top, step) => step)!.stack;
}

/** Encodes a clean input line to a compact token string. Throws on a malformed
 *  input (unknown kind or off-grid direction) — callers pass engine output, so
 *  a throw here means a bug upstream, not user input. */
export function encodeTrace(inputs: Input[]): string {
  let out = "";
  for (const inp of inputs) {
    const k = KINDS.indexOf(inp.kind);
    const d = dirIndex(inp.dir);
    if (k < 0 || d < 0) throw new Error("unencodable input");
    out += ALPHABET[k * 4 + d];
  }
  return out;
}

/** Decodes a token string back to an input line, or null on ANY malformation
 *  (unknown symbol, empty, or over the length ceiling). Never throws: this is a
 *  boundary parser for an untrusted URL segment. */
export function decodeTrace(s: string): Input[] | null {
  if (!s || s.length > MAX_REPLAY_STEPS) return null;
  const inputs: Input[] = [];
  for (const ch of s) {
    const t = ALPHABET.indexOf(ch);
    if (t < 0) return null;
    inputs.push({ kind: KINDS[Math.floor(t / 4)], dir: DIRS[t % 4] });
  }
  return inputs;
}
