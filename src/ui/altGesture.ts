// The single owner of the alt-gesture rule: which secondary gesture a state
// offers (split when merged, world-shift on decalage levels, none otherwise —
// merged wins even on decalage levels, since a split is the only way out).
// Availability, the input kind Shift/arm resolves to, and the control labels
// all derive from this one decision, so the game, the tutorial and the rule
// line cannot drift apart.

import type { GameState, Input, Level } from "../engine/types.ts";

export type AltKind = "split" | "shift";

/** The alt gesture `st` offers on `level`, or null when there is none. */
export function altGesture(st: GameState, level: Level): AltKind | null {
  if (st.merged) return "split";
  return level.mods.includes("decalage") ? "shift" : null;
}

/** Whether an input kind is an alt gesture — the ones that need arming. */
export const isAltKind = (kind: Input["kind"]): kind is AltKind =>
  kind !== "move";
