import { describe, expect, it } from 'vitest'
import type { Level, Pos } from '../engine/types.ts'
import { testLevel } from '../engine/testing.ts'
import { levelSignature } from './signature.ts'

// applique une transformation géométrique à toutes les positions d'un niveau
const xf = (l: Level, f: (p: Pos) => Pos): Level => ({
  ...l,
  a: { start: f(l.a.start), goal: f(l.a.goal), walls: l.a.walls.map(f) },
  b: { start: f(l.b.start), goal: f(l.b.goal), walls: l.b.walls.map(f) },
  lightWalls: l.lightWalls?.map(f),
})
const swap = (l: Level): Level => ({ ...l, a: l.b, b: l.a })

describe('levelSignature — invariance par symétrie', () => {
  const size = 5
  const m = size - 1
  const rot90 = (p: Pos): Pos => [p[1], m - p[0]]
  const flipCols = (p: Pos): Pos => [p[0], m - p[1]]
  const transpose = (p: Pos): Pos => [p[1], p[0]]

  const lv = testLevel({
    size,
    mods: ['fusion', 'scission'],
    a: { start: [4, 0], goal: [1, 4], walls: [[0, 4], [1, 3]] },
    b: { start: [0, 0], goal: [3, 4], walls: [[4, 4], [3, 3]] },
  })
  const sig = levelSignature(lv)

  it('rotation 90° → même signature', () => {
    expect(levelSignature(xf(lv, rot90))).toBe(sig)
  })
  it('miroir → même signature', () => {
    expect(levelSignature(xf(lv, flipCols))).toBe(sig)
  })
  it('transposée → même signature', () => {
    expect(levelSignature(xf(lv, transpose))).toBe(sig)
  })
  it('composition rotation + miroir → même signature', () => {
    expect(levelSignature(xf(xf(lv, rot90), flipCols))).toBe(sig)
  })
  it("l'ordre des mécaniques est ignoré", () => {
    expect(levelSignature({ ...lv, mods: ['scission', 'fusion'] })).toBe(sig)
  })
})

// mêmes deux calques (nombres de murs distincts → aucune symétrie du plateau ne
// peut les échanger), on ne fait varier QUE la présence de decalage
const asymA = { start: [0, 0] as Pos, goal: [0, 4] as Pos, walls: [[1, 1]] as Pos[] }
const asymB = { start: [4, 4] as Pos, goal: [2, 0] as Pos, walls: [[3, 2], [0, 3]] as Pos[] }

describe('levelSignature — échange des calques', () => {
  it('sans decalage, échanger A et B → même signature', () => {
    const lv = testLevel({ size: 5, mods: ['fusion', 'scission'], a: asymA, b: asymB })
    expect(levelSignature(swap(lv))).toBe(levelSignature(lv))
  })

  it('avec decalage, échanger A et B → signature différente (B est spécial)', () => {
    const lv = testLevel({ size: 5, mods: ['fusion', 'scission', 'decalage'], a: asymA, b: asymB })
    expect(levelSignature(swap(lv))).not.toBe(levelSignature(lv))
  })
})

describe('levelSignature — distinction', () => {
  it('deux niveaux différents → signatures différentes', () => {
    const a = testLevel({ size: 5, a: { start: [0, 0], goal: [4, 4], walls: [] }, b: { start: [0, 4], goal: [4, 0], walls: [] } })
    const b = testLevel({ size: 5, a: { start: [0, 0], goal: [4, 4], walls: [[2, 2]] }, b: { start: [0, 4], goal: [4, 0], walls: [] } })
    expect(levelSignature(a)).not.toBe(levelSignature(b))
  })

  it('les lightWalls comptent dans la signature', () => {
    const base = testLevel({
      size: 5, mods: ['fusion', 'scission', 'lumiere'],
      a: { start: [0, 0], goal: [4, 4], walls: [] },
      b: { start: [0, 4], goal: [4, 0], walls: [] },
      lightWalls: [[2, 2]],
    })
    expect(levelSignature(base)).not.toBe(levelSignature({ ...base, lightWalls: [[1, 1]] }))
  })
})
