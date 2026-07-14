// Anti-cheat: the client submits its winning input sequence; the server replays
// it through the pure engine to decide whether it truly wins and how many moves
// it took. The server trusts nothing the client says about its score. Pure and
// framework-free so it can be unit-tested directly (see replay.test.ts).

import type { Input, Level } from "../engine/types.ts";
import { initialState, isWin } from "../engine/state.ts";
import { applyInput } from "../engine/successors.ts";

export interface ReplayResult {
  ok: boolean;
  moves: number;
}

// Hard ceiling on submitted length: no honest size-5 solution is near this long,
// and it bounds replay work per request.
export const MAX_INPUTS = 500;

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
