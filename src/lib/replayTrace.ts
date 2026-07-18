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

/** The winning line of a raw play trace: corrections resolved away (undo pops
 *  the last input, reset clears), leaving exactly the inputs that reach the
 *  win — the same collapse the anti-cheat's state stack performs, on inputs. */
export function winningLine(trace: TraceStep[]): Input[] {
  const line: Input[] = [];
  for (const step of trace) {
    if (step.kind === "reset") line.length = 0;
    else if (step.kind === "undo") line.pop();
    else line.push(step);
  }
  return line;
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
