// BFS solver — knows NO rules: it consumes only
// successors/isWin/hashState. Any game/solver divergence is impossible.

import type { GameState, Input, Level, MechanicId } from '../engine/types.ts'
import { hashState, initialState, isWin } from '../engine/state.ts'
import { successors } from '../engine/successors.ts'

export interface Solution {
  inputs: Input[]
}

export function solve(level: Level, maxDepth = 80): Solution | null {
  const start = initialState(level)
  if (isWin(start, level)) return { inputs: [] }
  let frontier: [GameState, Input[]][] = [[start, []]]
  const seen = new Set<number>([hashState(start, level)])
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: [GameState, Input[]][] = []
    for (const [s, path] of frontier) {
      for (const [inp, ns] of successors(s, level)) {
        const h = hashState(ns, level)
        if (seen.has(h)) continue
        seen.add(h)
        const np = [...path, inp]
        if (isWin(ns, level)) return { inputs: np }
        next.push([ns, np])
      }
    }
    frontier = next
    if (!frontier.length) return null
  }
  return null
}

/** Solves a variant of the level with some mechanics removed. */
export function solveWithout(level: Level, removed: MechanicId[]): Solution | null {
  return solve({ ...level, mods: level.mods.filter((m) => !removed.includes(m)) })
}

export const fmtInput = (i: Input) =>
  (i.kind === 'split' ? 'S' : i.kind === 'shift' ? 'W' : '') +
  (i.dir[0] === -1 ? 'U' : i.dir[0] === 1 ? 'D' : i.dir[1] === -1 ? 'L' : 'R')
