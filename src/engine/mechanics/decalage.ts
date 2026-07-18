import type { GameState, Input, Mechanic } from "../types.ts";
import { add, DIRS } from "../grid.ts";
import { MAX_SHIFT, merges } from "../state.ts";

/** Slides layer B by one cell under the pawns. The worlds must end up aligned. */
export const decalage: Mechanic = {
  id: "decalage",
  mustBeNeeded: true,
  hooks: {
    extraSuccessors: (state, level) => {
      if (state.merged) return []; // once merged, the worlds move as one
      const out: [Input, GameState][] = [];
      for (const d of DIRS) {
        const off = add(state.off, d);
        if (Math.abs(off[0]) > MAX_SHIFT || Math.abs(off[1]) > MAX_SHIFT)
          continue;
        // sliding the world can trigger a merge under the new offset
        if (merges(level, state.a, state.b, off))
          out.push([
            { kind: "shift", dir: d },
            { merged: true, m: state.a, off },
          ]);
        else
          out.push([
            { kind: "shift", dir: d },
            { merged: false, a: state.a, b: state.b, off },
          ]);
      }
      return out;
    },
  },
};
