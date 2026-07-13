import { describe, expect, it } from 'vitest'
import type { GameState, Input, Pos } from './types.ts'
import { initialState } from './state.ts'
import { applyInput, successors } from './successors.ts'
import { testLevel } from './testing.ts'

const moveTo = (out: [Input, GameState][], dir: Pos) =>
  out.find(([inp]) => inp.kind === 'move' && inp.dir[0] === dir[0] && inp.dir[1] === dir[1])?.[1]

describe('successors — déplacements de base', () => {
  const level = testLevel({
    size: 3,
    a: { start: [1, 1], goal: [0, 0], walls: [] },
    b: { start: [1, 1], goal: [0, 0], walls: [[1, 0]] },
  })
  const start = initialState(level)

  it('un geste déplace les deux pions', () => {
    const next = moveTo(successors(start, level), [-1, 0])
    expect(next).toEqual({ merged: false, a: [0, 1], b: [0, 1], off: [0, 0] })
  })

  it('un mur ne bloque que le pion de son calque', () => {
    const next = moveTo(successors(start, level), [0, -1])
    expect(next).toEqual({ merged: false, a: [1, 0], b: [1, 1], off: [0, 0] })
  })

  it('le bord bloque comme un mur', () => {
    const edge = testLevel({
      size: 3,
      a: { start: [0, 0], goal: [2, 2], walls: [] },
      b: { start: [0, 2], goal: [2, 2], walls: [] },
    })
    const next = moveTo(successors(initialState(edge), edge), [-1, 0])
    expect(next).toBeUndefined() // both blocked → no successor
  })

  it('sans fusion, deux pions peuvent occuper la même case du plateau', () => {
    const meet = testLevel({
      size: 3,
      a: { start: [0, 0], goal: [2, 2], walls: [] },
      b: { start: [0, 1], goal: [2, 2], walls: [] },
    })
    const next = moveTo(successors(initialState(meet), meet), [0, -1])
    expect(next).toEqual({ merged: false, a: [0, 0], b: [0, 0], off: [0, 0] })
  })
})

describe('applyInput', () => {
  const level = testLevel({
    size: 3,
    a: { start: [1, 1], goal: [0, 0], walls: [] },
    b: { start: [1, 1], goal: [0, 0], walls: [] },
  })

  it('rejoue exactement le successeur correspondant', () => {
    const next = applyInput(initialState(level), level, { kind: 'move', dir: [1, 0] })
    expect(next).toEqual({ merged: false, a: [2, 1], b: [2, 1], off: [0, 0] })
  })

  it('renvoie null pour un input sans effet', () => {
    const corner = testLevel({
      size: 3,
      a: { start: [0, 0], goal: [2, 2], walls: [] },
      b: { start: [0, 0], goal: [2, 2], walls: [] },
    })
    expect(applyInput(initialState(corner), corner, { kind: 'move', dir: [-1, 0] })).toBeNull()
    expect(applyInput(initialState(corner), corner, { kind: 'split', dir: [1, 0] })).toBeNull()
  })
})
