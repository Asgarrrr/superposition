// The heart of the engine: enumerating legal moves.
// Both the game AND the solver consume only successors/applyInput — they can't diverge.

import type { GameState, Input, Level, MoveCtx, Pos } from "./types.ts";
import { active } from "./mechanics/registry.ts";
import { DIRS, eq, inBounds, sub, wallSet } from "./grid.ts";
import { merges } from "./state.ts";

const stepMove = (pos: Pos, dir: Pos, ctx: MoveCtx): Pos => {
  const n = ctx.level.size;
  const r = pos[0] + dir[0];
  const c = pos[1] + dir[1];
  if (!inBounds(r, c, n) || ctx.walls.has(r * n + c)) return pos;
  return [r, c];
};

export function successors(
  state: GameState,
  level: Level,
): [Input, GameState][] {
  const mechs = active(level);
  const n = level.size;
  const movers = mechs.filter((m) => m.hooks.resolveMove);
  // no composition order exists for movement — two movers is a level-design bug
  if (movers.length > 1)
    throw new Error(
      `level ${level.id}: several mechanics define resolveMove (${movers.map((m) => m.id).join(", ")})`,
    );
  const resolve = movers[0]?.hooks.resolveMove ?? stepMove;

  const out: [Input, GameState][] = [];

  if (!state.merged) {
    const wa = wallSet(level.a.walls, n);
    const wb = wallSet(level.b.walls, n);
    for (const dir of DIRS) {
      const na = resolve(state.a, dir, { level, walls: wa });
      const nb = resolve(state.b, dir, { level, walls: wb });
      if (eq(na, state.a) && eq(nb, state.b)) continue;
      if (merges(level, na, nb, state.off))
        out.push([
          { kind: "move", dir },
          { merged: true, m: na, off: state.off },
        ]);
      else
        out.push([
          { kind: "move", dir },
          { merged: false, a: na, b: nb, off: state.off },
        ]);
    }
  } else {
    // white pawn, board coordinates: it is A at m and B at m - off,
    // both must stay inside the grid; only light blocks it.
    const lightList = mechs.flatMap((m) => m.hooks.mergedWalls?.(level) ?? []);
    const wl = wallSet(lightList, n);
    for (const dir of DIRS) {
      const nm = resolve(state.m, dir, { level, walls: wl });
      const bSide = sub(nm, state.off);
      if (eq(nm, state.m)) continue;
      if (!inBounds(bSide[0], bSide[1], n)) continue;
      out.push([
        { kind: "move", dir },
        { merged: true, m: nm, off: state.off },
      ]);
    }
  }

  for (const m of mechs) {
    if (m.hooks.extraSuccessors)
      out.push(...m.hooks.extraSuccessors(state, level));
  }
  return out;
}

export function applyInput(
  state: GameState,
  level: Level,
  input: Input,
): GameState | null {
  for (const [inp, next] of successors(state, level)) {
    if (inp.kind === input.kind && eq(inp.dir, input.dir)) return next;
  }
  return null;
}
