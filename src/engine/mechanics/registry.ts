// The registry — to add a mechanic: a file alongside, an entry here,
// its id in MechanicId (types.ts). Nothing else to touch on the engine side.

import type { GameState, Level, Mechanic, MechanicId, MoveCtx, Pos } from "../types.ts";
import { decalage } from "./decalage.ts";
import { fusion } from "./fusion.ts";
import { glace } from "./glace.ts";
import { lumiere } from "./lumiere.ts";
import { repere } from "./repere.ts";
import { scission } from "./scission.ts";
import { verso } from "./verso.ts";

export const MECHANICS: Record<MechanicId, Mechanic> = {
  glace,
  fusion,
  scission,
  lumiere,
  decalage,
  verso,
  repere,
};

/** Per-level derived mechanics, computed once — successors() runs per BFS
 * expansion, so anything re-derivable from the immutable level is hoisted here. */
export interface CompiledMechanics {
  mechs: Mechanic[];
  resolveMove?: (pos: Pos, dir: Pos, ctx: MoveCtx) => Pos;
  mapDirB?: (dir: Pos) => Pos;
  settle?: (next: GameState, level: Level) => GameState;
  canMerge: boolean;
}

const cache = new WeakMap<Level, CompiledMechanics>();

// The single active hook among `mechs`, or undefined — throws if two define it,
// since these hooks (movement, B's direction, the offset correction) have no
// composition order.
const only = <T>(
  mechs: Mechanic[],
  pick: (m: Mechanic) => T | undefined,
  id: string,
  level: Level,
): T | undefined => {
  const hit = mechs.filter((m) => pick(m) !== undefined);
  if (hit.length > 1)
    throw new Error(
      `level ${level.id}: several mechanics define ${id} (${hit.map((m) => m.id).join(", ")})`,
    );
  return hit[0] ? pick(hit[0]) : undefined;
};

export const compiled = (level: Level): CompiledMechanics => {
  const hit = cache.get(level);
  if (hit) return hit;
  const mechs = level.mods.map((id) => MECHANICS[id]);
  const rec: CompiledMechanics = {
    mechs,
    resolveMove: only(mechs, (m) => m.hooks.resolveMove, "resolveMove", level),
    mapDirB: only(mechs, (m) => m.hooks.mapDirB, "mapDirB", level),
    settle: only(mechs, (m) => m.hooks.settle, "settle", level),
    canMerge: mechs.some((m) => m.hooks.enablesMerge),
  };
  cache.set(level, rec);
  return rec;
};

export const active = (level: Level): Mechanic[] => compiled(level).mechs;
