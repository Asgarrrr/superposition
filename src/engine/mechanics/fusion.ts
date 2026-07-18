import type { Mechanic } from "../types.ts";

/**
 * A merge is a BOARD event: it happens when a == b + off.
 * The merged pawn passes through ink walls (only light stops it).
 */
export const fusion: Mechanic = {
  id: "fusion",
  // a split only exists to undo a merge: proving fusion removable must strip both
  removedWith: ["fusion", "scission"],
  mustBeNeeded: true,
  hooks: { enablesMerge: true },
};
