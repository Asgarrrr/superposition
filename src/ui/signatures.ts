// The single owner of the verb → sensory-signature mapping: every effect is a
// legible consequence of game state, so the game (useGame) and its tutorial
// (useDemo) must resolve the SAME transition to the SAME sound + haptic — this
// module is where that decision lives. Pure data out: callers execute
// fx[sig.fx]() and vibrate(sig.vibrate), which keeps the mapping testable.

import type { GameState, Input, Level } from "../engine/types.ts";
import type { SoundFx } from "./hooks/useSound.ts";

export interface Signature {
  fx: keyof Pick<
    SoundFx,
    "block" | "merge" | "shift" | "split" | "slide" | "move"
  >;
  /** null: the verb is sound-only (slide and plain move stay silent hands). */
  vibrate: number | number[] | null;
}

/** Resolve an applied input to its sensory signature.
 *  `next === null` is an engine refusal. Order is semantics: a merge is the
 *  headline event and wins even when a shift or split caused it. */
export function inputSignature(
  prev: GameState,
  next: GameState | null,
  kind: Input["kind"],
  level: Level,
): Signature {
  if (next === null) return { fx: "block", vibrate: 25 };
  if (!prev.merged && next.merged)
    return { fx: "merge", vibrate: [10, 20, 40] };
  if (kind === "shift") return { fx: "shift", vibrate: 40 };
  if (kind === "split") return { fx: "split", vibrate: [15, 30, 15] };
  if (level.mods.includes("glace")) return { fx: "slide", vibrate: null };
  return { fx: "move", vibrate: null };
}
