// Level generation core, shared by the `gen` CLI (generate.ts) and the daily
// cron (generate-daily.ts). Hunts random levels and keeps only those where each
// requested mechanic is PROVEN necessary (removing it makes the level
// unsolvable). Pure/importable — no argv, no printing.

import type { Level, MechanicId, Pos } from "../engine/types.ts";
import { fmtInput, solve, solveWithout } from "./bfs.ts";

const rnd = (n: number) => Math.floor(Math.random() * n);

export function randomLevel(mods: MechanicId[], size: number): Level {
  const cell = (): Pos => [rnd(size), rnd(size)];
  const ck = (p: Pos) => p[0] * size + p[1];
  const aStart = cell();
  const bStart = cell();
  const aGoal = cell();
  const bGoal = Math.random() < 0.4 ? aGoal : cell();
  const mk = (used: Set<number>, count: number): Pos[] => {
    const walls: Pos[] = [];
    while (walls.length < count) {
      const p = cell();
      if (!used.has(ck(p))) {
        used.add(ck(p));
        walls.push(p);
      }
    }
    return walls;
  };
  const lv: Level = {
    id: "gen",
    ch: "GEN",
    name: "gen",
    size,
    mods,
    a: {
      start: aStart,
      goal: aGoal,
      walls: mk(new Set([ck(aStart), ck(aGoal)]), size - 2 + rnd(size)),
    },
    b: {
      start: bStart,
      goal: bGoal,
      walls: mk(new Set([ck(bStart), ck(bGoal)]), size - 2 + rnd(size)),
    },
  };
  if (mods.includes("lumiere"))
    lv.lightWalls = mk(new Set(), 1 + rnd(size - 2));
  return lv;
}

export interface Found {
  lv: Level;
  len: number;
  sol: string;
  proofs: string[];
  score: number;
}

export interface HuntOpts {
  mods: MechanicId[];
  size: number;
  minLen: number;
  budgetMs: number;
}

/** Searches for `budgetMs` and returns the certified levels found, best first. */
export function hunt({ mods, size, minLen, budgetMs }: HuntOpts): {
  found: Found[];
  tested: number;
} {
  const found: Found[] = [];
  const t0 = Date.now();
  let tested = 0;

  while (Date.now() - t0 < budgetMs) {
    tested++;
    const lv = randomLevel(mods, size);
    const full = solve(lv);
    if (!full || full.inputs.length < minLen) continue;
    // proof of necessity: removing each mechanic must make the level unsolvable
    const proofs: string[] = [];
    let allEssential = true;
    for (const mo of mods) {
      const removed: MechanicId[] =
        mo === "fusion" ? ["fusion", "scission"] : [mo];
      if (solveWithout(lv, removed) === null) proofs.push(mo + " obligatoire");
      else if (mo === "fusion" || mo === "scission" || mo === "decalage") {
        allEssential = false;
        break;
      }
      // ice / light: not required to be mandatory, they already change the texture
    }
    if (!allEssential) continue;
    found.push({
      lv,
      len: full.inputs.length,
      sol: full.inputs.map(fmtInput).join(" "),
      proofs,
      score: full.inputs.length + proofs.length * 5,
    });
  }

  found.sort((a, b) => b.score - a.score);
  return { found, tested };
}
