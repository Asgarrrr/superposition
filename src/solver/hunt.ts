// Level generation core, shared by the `gen` CLI (generate.ts) and the daily
// cron (generate-daily.ts). Hunts random levels and keeps only those where each
// requested mechanic is PROVEN necessary (removing it makes the level
// unsolvable). Pure/importable — no argv, no printing.

import type { Level, MechanicId, Pos } from "../engine/types.ts";
import { MECHANICS } from "../engine/mechanics/registry.ts";
import { fmtInput, solve, solveWithout } from "./bfs.ts";
import { levelSignature } from "./signature.ts";

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
  sig: string; // symmetry-aware canonical signature (see signature.ts)
}

export interface HuntOpts {
  mods: MechanicId[];
  size: number;
  minLen: number;
  budgetMs: number;
  /** Signatures to skip: a candidate whose signature is here — an already-used
   *  puzzle, or a mirror/rotation of one — is rejected, never returned. */
  seen?: Set<string>;
  /** Stop the instant a kept, new candidate is this short (or shorter). The
   *  daily passes its per-tier `minLen` (the floor its "shortest ≥ minLen" pick
   *  can reach), so it bails as soon as it can't do better rather than burning
   *  the whole budget. Omit to search for the full `budgetMs`. */
  stopAtLen?: number;
}

/** Searches for up to `budgetMs` and returns the certified levels found, best
 *  first. Stops early if `stopAtLen` is met; skips anything in `seen`. */
export function hunt({
  mods,
  size,
  minLen,
  budgetMs,
  seen,
  stopAtLen,
}: HuntOpts): {
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
      const { removedWith, mustBeNeeded } = MECHANICS[mo];
      if (solveWithout(lv, removedWith ?? [mo]) === null)
        proofs.push(mo + " obligatoire");
      else if (mustBeNeeded) {
        allEssential = false;
        break;
      }
      // non-mustBeNeeded mechanics (ice / light) may be avoidable — they
      // already change the texture of play, so we keep the level anyway
    }
    if (!allEssential) continue;
    // reject a puzzle already used (or a symmetry of one) before keeping it
    const sig = levelSignature(lv);
    if (seen?.has(sig)) continue;
    const len = full.inputs.length;
    found.push({
      lv,
      len,
      sol: full.inputs.map(fmtInput).join(" "),
      proofs,
      score: len + proofs.length * 5,
      sig,
    });
    if (stopAtLen !== undefined && len <= stopAtLen) break;
  }

  found.sort((a, b) => b.score - a.score);
  return { found, tested };
}
