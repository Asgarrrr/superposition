import type { Mechanic, Pos } from "../types.ts";

/** The magenta film laid emulsion-down: layer B reads horizontal moves mirrored
 * (left ↔ right), columns only. Applies to `move` while unmerged — split and
 * shift are deliberate gestures on the film itself, untouched; once fused the
 * pawn lives on the glass and follows the raw direction. */
export const verso: Mechanic = {
  id: "verso",
  mustBeNeeded: true,
  hooks: {
    mapDirB: (dir): Pos => [dir[0], -dir[1]],
  },
};
