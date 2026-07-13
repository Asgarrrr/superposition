// Grid geometry — no game rules here.

import type { Pos } from './types.ts'

export const DIRS: Pos[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

export const inBounds = (r: number, c: number, n: number) =>
  r >= 0 && r < n && c >= 0 && c < n

export const eq = (p: Pos, q: Pos) => p[0] === q[0] && p[1] === q[1]

export const add = (p: Pos, q: Pos): Pos => [p[0] + q[0], p[1] + q[1]]

export const sub = (p: Pos, q: Pos): Pos => [p[0] - q[0], p[1] - q[1]]

export const wallSet = (walls: Pos[], n: number): Set<number> => {
  const s = new Set<number>()
  for (const [r, c] of walls) s.add(r * n + c)
  return s
}
