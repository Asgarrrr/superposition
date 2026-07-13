import { describe, expect, it } from 'vitest'
import type { GameState, Input, Pos } from '../types.ts'
import { initialState, MAX_SHIFT } from '../state.ts'
import { successors } from '../successors.ts'
import { testLevel } from '../testing.ts'

const byInput = (out: [Input, GameState][], kind: Input['kind'], dir: Pos) =>
  out.find(([inp]) => inp.kind === kind && inp.dir[0] === dir[0] && inp.dir[1] === dir[1])?.[1]

describe('fusion', () => {
  it('la rencontre sur une même case du plateau fusionne', () => {
    const level = testLevel({
      size: 3,
      mods: ['fusion'],
      a: { start: [0, 0], goal: [2, 2], walls: [] },
      b: { start: [0, 1], goal: [2, 2], walls: [] },
    })
    const next = byInput(successors(initialState(level), level), 'move', [0, -1])
    expect(next).toEqual({ merged: true, m: [0, 0], off: [0, 0] })
  })

  it('la rencontre se juge en coordonnées PLATEAU (b + off)', () => {
    const level = testLevel({
      size: 3,
      mods: ['fusion'],
      a: { start: [0, 0], goal: [2, 2], walls: [] },
      b: { start: [0, 0], goal: [2, 2], walls: [] },
    })
    // b is at [1,1] on its layer but at [1,2] on the board (off [0,1]).
    const st: GameState = { merged: false, a: [1, 1], b: [1, 1], off: [0, 1] }
    const out = successors(st, level)
    // a and b move with the same gesture: the board gap is preserved, no merge
    expect(out.every(([, s]) => !s.merged)).toBe(true)
    // a blocked by the edge while b catches up to it on the board:
    const st2: GameState = { merged: false, a: [2, 1], b: [0, 1], off: [1, 0] }
    // b board = [1,1]; moving down, a stays [2,1], b moves to [1,1] → board [2,1]
    const mergedNext = byInput(successors(st2, level), 'move', [1, 0])
    expect(mergedNext).toEqual({ merged: true, m: [2, 1], off: [1, 0] })
  })

  it('fusionné, la lumière traverse les murs d’encre', () => {
    const level = testLevel({
      size: 3,
      mods: ['fusion'],
      a: { start: [0, 0], goal: [2, 2], walls: [[1, 1]] },
      b: { start: [0, 0], goal: [2, 2], walls: [[1, 1]] },
    })
    const st: GameState = { merged: true, m: [0, 1], off: [0, 0] }
    const next = byInput(successors(st, level), 'move', [1, 0])
    expect(next).toEqual({ merged: true, m: [1, 1], off: [0, 0] })
  })

  it('fusionné avec offset, les deux projections doivent rester dans la grille', () => {
    const level = testLevel({
      size: 3,
      mods: ['fusion'],
      a: { start: [0, 0], goal: [2, 2], walls: [] },
      b: { start: [0, 0], goal: [2, 2], walls: [] },
    })
    // m - off = side B; with off [0,1], m cannot reach column 0.
    const st: GameState = { merged: true, m: [0, 1], off: [0, 1] }
    expect(byInput(successors(st, level), 'move', [0, -1])).toBeUndefined()
  })
})

describe('scission', () => {
  const level = testLevel({
    size: 3,
    mods: ['fusion', 'scission'],
    a: { start: [0, 0], goal: [2, 2], walls: [] },
    b: { start: [0, 0], goal: [2, 2], walls: [[1, 1]] },
  })

  it('cyan part dans le sens choisi, magenta à l’opposé', () => {
    const st: GameState = { merged: true, m: [1, 1], off: [0, 0] }
    const next = byInput(successors(st, level), 'split', [0, 1])
    expect(next).toEqual({ merged: false, a: [1, 2], b: [1, 0], off: [0, 0] })
  })

  it('impossible si un des deux côtés sort de la grille', () => {
    const corner: GameState = { merged: true, m: [0, 1], off: [0, 0] }
    expect(byInput(successors(corner, level), 'split', [-1, 0])).toBeUndefined()
  })

  it('impossible si le côté magenta est muré dans SON calque', () => {
    const wide = testLevel({
      size: 4,
      mods: ['fusion', 'scission'],
      a: { start: [0, 0], goal: [3, 3], walls: [] },
      b: { start: [0, 0], goal: [3, 3], walls: [[1, 1]] },
    })
    const st: GameState = { merged: true, m: [1, 2], off: [0, 0] }
    // split → right: b would go to [1,1], walled off on side B
    expect(byInput(successors(st, wide), 'split', [0, 1])).toBeUndefined()
    // split → left: both sides are clear
    expect(byInput(successors(st, wide), 'split', [0, -1]))
      .toEqual({ merged: false, a: [1, 1], b: [1, 3], off: [0, 0] })
  })

  it('absent tant qu’on n’est pas fusionné', () => {
    const out = successors(initialState(level), level)
    expect(out.some(([inp]) => inp.kind === 'split')).toBe(false)
  })
})

describe('glace', () => {
  const level = testLevel({
    size: 4,
    mods: ['glace'],
    a: { start: [0, 0], goal: [3, 3], walls: [[0, 3]] },
    b: { start: [0, 0], goal: [3, 3], walls: [] },
  })

  it('tout glisse jusqu’à l’obstacle', () => {
    const next = byInput(successors(initialState(level), level), 'move', [0, 1])
    // a stops in front of its wall [0,3], b slides to the edge
    expect(next).toEqual({ merged: false, a: [0, 2], b: [0, 3], off: [0, 0] })
  })

  it('le pion fusionné glisse aussi', () => {
    const iced = testLevel({
      size: 4,
      mods: ['glace', 'fusion'],
      a: { start: [0, 0], goal: [3, 3], walls: [] },
      b: { start: [0, 0], goal: [3, 3], walls: [] },
    })
    const st: GameState = { merged: true, m: [0, 0], off: [0, 0] }
    const next = byInput(successors(st, iced), 'move', [1, 0])
    expect(next).toEqual({ merged: true, m: [3, 0], off: [0, 0] })
  })
})

describe('lumière', () => {
  const level = testLevel({
    size: 3,
    mods: ['fusion', 'lumiere'],
    lightWalls: [[1, 1]],
    a: { start: [0, 1], goal: [2, 1], walls: [] },
    b: { start: [0, 1], goal: [2, 1], walls: [] },
  })

  it('les carrés blancs ne bloquent que le pion fusionné', () => {
    const st: GameState = { merged: true, m: [0, 1], off: [0, 0] }
    expect(byInput(successors(st, level), 'move', [1, 0])).toBeUndefined()
  })

  it('les encres traversent les carrés blancs', () => {
    // without merge active, otherwise meeting at [1,1] would merge them
    const inksOnly = testLevel({ ...level, mods: ['lumiere'] })
    const next = byInput(successors(initialState(inksOnly), inksOnly), 'move', [1, 0])
    expect(next).toEqual({ merged: false, a: [1, 1], b: [1, 1], off: [0, 0] })
  })
})

describe('décalage', () => {
  const level = testLevel({
    size: 3,
    mods: ['fusion', 'decalage'],
    a: { start: [0, 0], goal: [2, 2], walls: [] },
    b: { start: [2, 2], goal: [2, 2], walls: [] },
  })

  it('glisse le monde B d’une case sans bouger les pions', () => {
    const next = byInput(successors(initialState(level), level), 'shift', [0, 1])
    expect(next).toEqual({ merged: false, a: [0, 0], b: [2, 2], off: [0, 1] })
  })

  it(`borné à ±${MAX_SHIFT} par axe`, () => {
    const st: GameState = { merged: false, a: [0, 0], b: [2, 2], off: [0, MAX_SHIFT] }
    expect(byInput(successors(st, level), 'shift', [0, 1])).toBeUndefined()
    expect(byInput(successors(st, level), 'shift', [0, -1])).toBeDefined()
  })

  it('glisser le monde peut provoquer la fusion', () => {
    const st: GameState = { merged: false, a: [1, 1], b: [1, 0], off: [0, 0] }
    const next = byInput(successors(st, level), 'shift', [0, 1])
    expect(next).toEqual({ merged: true, m: [1, 1], off: [0, 1] })
  })

  it('fusionnés, les mondes sont solidaires : plus de décalage', () => {
    const st: GameState = { merged: true, m: [1, 1], off: [0, 0] }
    expect(successors(st, level).some(([inp]) => inp.kind === 'shift')).toBe(false)
  })
})
