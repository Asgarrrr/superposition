import type { GameState, Input, Mechanic } from "../types.ts";
import { add, DIRS, inBounds, sub, wallSet } from "../grid.ts";

/** From the merged state: cyan goes in the chosen direction, magenta the opposite. */
export const scission: Mechanic = {
  id: "scission",
  mustBeNeeded: true,
  hooks: {
    extraSuccessors: (state, level) => {
      if (!state.merged) return [];
      const out: [Input, GameState][] = [];
      const n = level.size;
      const wa = wallSet(level.a.walls, n);
      const wb = wallSet(level.b.walls, n);
      // the white pawn is A at m (board) and B at m - off (layer B)
      const bHome = sub(state.m, state.off);
      for (const d of DIRS) {
        const a = add(state.m, d);
        const b = sub(bHome, d);
        if (!inBounds(a[0], a[1], n) || wa.has(a[0] * n + a[1])) continue;
        if (!inBounds(b[0], b[1], n) || wb.has(b[0] * n + b[1])) continue;
        out.push([
          { kind: "split", dir: d },
          { merged: false, a, b, off: state.off },
        ]);
      }
      return out;
    },
  },
};
