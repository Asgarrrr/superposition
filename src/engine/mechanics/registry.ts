// The registry — to add a mechanic: a file alongside, an entry here,
// its id in MechanicId (types.ts). Nothing else to touch on the engine side.

import type { Level, Mechanic, MechanicId, MoveCtx, Pos } from "../types.ts";
import { decalage } from "./decalage.ts";
import { fusion } from "./fusion.ts";
import { glace } from "./glace.ts";
import { lumiere } from "./lumiere.ts";
import { scission } from "./scission.ts";

export const MECHANICS: Record<MechanicId, Mechanic> = {
  glace,
  fusion,
  scission,
  lumiere,
  decalage,
};

/** Per-level derived mechanics, computed once — successors() runs per BFS
 * expansion, so anything re-derivable from the immutable level is hoisted here. */
export interface CompiledMechanics {
  mechs: Mechanic[];
  resolveMove?: (pos: Pos, dir: Pos, ctx: MoveCtx) => Pos;
  canMerge: boolean;
}

const cache = new WeakMap<Level, CompiledMechanics>();

export const compiled = (level: Level): CompiledMechanics => {
  const hit = cache.get(level);
  if (hit) return hit;
  const mechs = level.mods.map((id) => MECHANICS[id]);
  const movers = mechs.filter((m) => m.hooks.resolveMove);
  // no composition order exists for movement — two movers is a level-design bug
  if (movers.length > 1)
    throw new Error(
      `level ${level.id}: several mechanics define resolveMove (${movers.map((m) => m.id).join(", ")})`,
    );
  const rec: CompiledMechanics = {
    mechs,
    resolveMove: movers[0]?.hooks.resolveMove,
    canMerge: mechs.some((m) => m.hooks.enablesMerge),
  };
  cache.set(level, rec);
  return rec;
};

export const active = (level: Level): Mechanic[] => compiled(level).mechs;
