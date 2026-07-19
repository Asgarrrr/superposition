// A symmetry-aware canonical signature for a level. Two levels related by any
// rotation or reflection of the board (the dihedral group D4) — and, when the
// mechanics treat both layers alike, by swapping the two layers — collapse to
// the SAME signature. The daily generator uses it to guarantee it never
// reissues a puzzle, or a mere mirror/rotation of one, it has already used.

import type { Level, LayerDef, Pos } from "../engine/types.ts";

type Xf = (p: Pos) => Pos;

// The 8 symmetries of the square (4 rotations × 2 reflections), on an n×n grid.
function d4(size: number): Xf[] {
  const m = size - 1;
  return [
    ([r, c]) => [r, c], // identity
    ([r, c]) => [c, m - r], // rot 90
    ([r, c]) => [m - r, m - c], // rot 180
    ([r, c]) => [m - c, r], // rot 270
    ([r, c]) => [m - r, c], // flip rows
    ([r, c]) => [r, m - c], // flip cols
    ([r, c]) => [c, r], // transpose
    ([r, c]) => [m - c, m - r], // anti-transpose
  ];
}

// The subgroup of D4 that fixes the COLUMN-mirror axis (columns stay columns):
// identity, rot180, flip rows, flip cols. verso pins that axis, so rotations and
// transposes — which turn it into a row-mirror — are no longer the same puzzle.
function colAxisFixed(size: number): Xf[] {
  const m = size - 1;
  return [
    ([r, c]) => [r, c], // identity
    ([r, c]) => [m - r, m - c], // rot 180
    ([r, c]) => [m - r, c], // flip rows
    ([r, c]) => [r, m - c], // flip cols
  ];
}

// A layer as a stable string under transform `xf`: walls are order-independent,
// so they're sorted; start and goal keep their roles.
function serLayer(l: LayerDef, xf: Xf): string {
  const p = (q: Pos) => xf(q).join(",");
  const walls = l.walls.map(p).sort().join(";");
  return `${p(l.start)}>${p(l.goal)}/${walls}`;
}

/** Canonical signature: the lexicographically smallest representation across all
 *  board symmetries (and, when `decalage` is absent, layer order). Equal
 *  signatures ⇒ the same puzzle up to symmetry. */
export function levelSignature(lv: Level): string {
  const mods = [...lv.mods].sort().join(",");
  const verso = lv.mods.includes("verso");
  // decalage shifts layer B and verso mirrors it: A and B stop being
  // interchangeable then. Every other mechanic treats the two layers alike.
  const allowSwap = !lv.mods.includes("decalage") && !verso;
  // verso pins the column-mirror axis — only the symmetries that fix it survive.
  const xfs = verso ? colAxisFixed(lv.size) : d4(lv.size);
  const absolute = (ws: Pos[] | undefined, xf: Xf) =>
    (ws ?? []).map((w) => xf(w).join(",")).sort().join(";");
  let best: string | null = null;
  for (const xf of xfs) {
    const A = serLayer(lv.a, xf);
    const B = serLayer(lv.b, xf);
    // lightWalls and pins are board-absolute (they don't move on a layer swap)
    const light = absolute(lv.lightWalls, xf);
    const pins = absolute(lv.pins, xf);
    const orders = allowSwap ? [`${A}|${B}`, `${B}|${A}`] : [`${A}|${B}`];
    for (const layers of orders) {
      const s = `${lv.size}#${mods}#${layers}#${light}#${pins}`;
      if (best === null || s < best) best = s;
    }
  }
  return best!;
}
