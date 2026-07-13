import { describe, expect, it } from 'vitest'
import type { GameState } from './types.ts'
import { hashState, initialState, isWin } from './state.ts'
import { successors } from './successors.ts'
import { testLevel } from './testing.ts'

describe('initialState', () => {
  it('place chaque pion sur son départ, mondes alignés', () => {
    const level = testLevel({
      size: 3,
      a: { start: [2, 0], goal: [0, 0], walls: [] },
      b: { start: [2, 2], goal: [0, 2], walls: [] },
    })
    expect(initialState(level)).toEqual({
      merged: false,
      a: [2, 0],
      b: [2, 2],
      off: [0, 0],
    })
  })
})

describe('isWin', () => {
  const level = testLevel({
    size: 3,
    a: { start: [2, 0], goal: [0, 0], walls: [] },
    b: { start: [2, 2], goal: [0, 2], walls: [] },
  })

  it('vrai quand chaque pion est sur son cercle', () => {
    const st: GameState = { merged: false, a: [0, 0], b: [0, 2], off: [0, 0] }
    expect(isWin(st, level)).toBe(true)
  })

  it('faux tant que les mondes sont décalés, même pions bien placés', () => {
    const st: GameState = { merged: false, a: [0, 0], b: [0, 2], off: [0, 1] }
    expect(isWin(st, level)).toBe(false)
  })

  it('fusionné : gagne seulement si les deux buts coïncident', () => {
    const shared = testLevel({
      size: 3,
      a: { start: [2, 0], goal: [0, 1], walls: [] },
      b: { start: [2, 2], goal: [0, 1], walls: [] },
    })
    const st: GameState = { merged: true, m: [0, 1], off: [0, 0] }
    expect(isWin(st, shared)).toBe(true)
    expect(isWin(st, level)).toBe(false) // distinct goals: impossible while merged
  })
})

describe('hashState', () => {
  it('est injectif sur tous les états atteignables', () => {
    const level = testLevel({
      size: 4,
      mods: ['fusion', 'scission', 'decalage'],
      a: { start: [3, 0], goal: [0, 3], walls: [[1, 1]] },
      b: { start: [3, 3], goal: [0, 0], walls: [[2, 2]] },
    })
    const seen = new Map<number, string>()
    const frontier: GameState[] = [initialState(level)]
    seen.set(hashState(initialState(level), level), JSON.stringify(initialState(level)))
    while (frontier.length) {
      const st = frontier.pop()!
      for (const [, next] of successors(st, level)) {
        const h = hashState(next, level)
        const key = JSON.stringify(next)
        if (seen.has(h)) {
          expect(seen.get(h)).toBe(key)
        } else {
          seen.set(h, key)
          frontier.push(next)
        }
      }
    }
    expect(seen.size).toBeGreaterThan(100) // the explored space is real
  })
})
