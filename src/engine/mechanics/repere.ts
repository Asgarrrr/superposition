import type { Level, Mechanic, Pos } from "../types.ts";
import { add, eq, inBounds, wallSet } from "../grid.ts";
import { merges } from "../state.ts";

/** Move a coordinate one notch toward zero (stops at zero). */
const toward0 = (x: number): number => (x > 0 ? x - 1 : x < 0 ? x + 1 : 0);

// Pins are immutable per level — settle() runs on every successor of every BFS
// expansion, so derive the lookup set once (registry WeakMap pattern).
const pinSets = new WeakMap<Level, Set<number>>();
const pinsOf = (level: Level): Set<number> => {
  let s = pinSets.get(level);
  if (!s) pinSets.set(level, (s = wallSet(level.pins ?? [], level.size)));
  return s;
};

/** Registration pins (goupilles de calage) fixed to the glass. After any input,
 * in an unmerged state with off != [0,0], if a pawn's BOARD cell (a, or b + off)
 * sits on a pin, off snaps one notch toward [0,0] on each nonzero axis — once,
 * no cascade. The snap may itself trigger the merge. Only matters when decalage
 * can open an offset; the pins stay inert (data preserved) otherwise.
 *
 * NOT mustBeNeeded (exempt like ice / light): a pin is never strictly required.
 * The offset only moves via decalage's shift or this snap, and shift is
 * unconstrained (no walls, just the MAX_SHIFT box), so it freely reproduces any
 * snap — a diagonal snap's two single-axis detours have distinct intermediates,
 * at most one hits a premature merge, so a clean shift path always remains. A
 * pin thus changes the texture of play (forced snaps, alternate merge routes)
 * without ever being provable-necessary; `isRequired(_, "repere")` is always
 * false and hunt keeps such levels on the strength of their other mechanics. */
export const repere: Mechanic = {
  id: "repere",
  hooks: {
    settle: (next, level) => {
      // merged films move as one; pins act only while the worlds are offset
      if (next.merged || eq(next.off, [0, 0])) return next;
      const n = level.size;
      const pins = pinsOf(level);
      const bb = add(next.b, next.off); // pawn B on the board
      const aHit = pins.has(next.a[0] * n + next.a[1]);
      const bHit = inBounds(bb[0], bb[1], n) && pins.has(bb[0] * n + bb[1]);
      if (!aHit && !bHit) return next;
      const off: Pos = [toward0(next.off[0]), toward0(next.off[1])];
      if (merges(level, next.a, next.b, off))
        return { merged: true, m: next.a, off };
      return { merged: false, a: next.a, b: next.b, off };
    },
  },
};
