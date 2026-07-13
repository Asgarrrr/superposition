// State lifecycle: creation, win check, hashing.
// Frames of reference: pawn A and the board share coordinates.
// Pawn B lives in ITS layer's coordinates; its position on the
// board is b + off. The merged pawn lives on the board.

import type { GameState, Level } from './types.ts'
import { eq } from './grid.ts'

/** Bound on the offset between worlds — sizes the state space AND its hashing. */
export const MAX_SHIFT = 2
const SHIFT_SPAN = 2 * MAX_SHIFT + 1

export function initialState(level: Level): GameState {
  return { merged: false, a: level.a.start, b: level.b.start, off: [0, 0] }
}

export function isWin(state: GameState, level: Level): boolean {
  if (!eq(state.off, [0, 0])) return false // the worlds must be realigned
  if (!state.merged) return eq(state.a, level.a.goal) && eq(state.b, level.b.goal)
  return eq(level.a.goal, level.b.goal) && eq(state.m, level.a.goal)
}

export function hashState(state: GameState, level: Level): number {
  const n = level.size
  const n2 = n * n
  const offKey = (state.off[0] + MAX_SHIFT) * SHIFT_SPAN + (state.off[1] + MAX_SHIFT)
  const posKey = state.merged
    ? n2 * n2 + state.m[0] * n + state.m[1]
    : (state.a[0] * n + state.a[1]) * n2 + state.b[0] * n + state.b[1]
  return posKey * (SHIFT_SPAN * SHIFT_SPAN) + offKey
}
