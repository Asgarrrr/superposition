// The engine contract: state is FINITE, DISCRETE, DETERMINISTIC, HASHABLE.
// No randomness during play, no real time, no hidden information.

export type Pos = readonly [number, number]

export type Input =
  | { kind: 'move'; dir: Pos }
  | { kind: 'split'; dir: Pos }
  | { kind: 'shift'; dir: Pos } // shifts layer B by one cell

/** `off`: offset of layer B relative to layer A (bounded). */
export type GameState =
  | { merged: false; a: Pos; b: Pos; off: Pos }
  | { merged: true; m: Pos; off: Pos }

export interface LayerDef {
  start: Pos
  goal: Pos
  walls: Pos[]
}

export type MechanicId = 'fusion' | 'scission' | 'lumiere' | 'glace' | 'decalage'

export interface Level {
  id: string
  ch: string
  name: string
  size: number
  mods: MechanicId[]
  a: LayerDef
  b: LayerDef
  lightWalls?: Pos[] // in board coordinates (layer A)
}

export interface MoveCtx {
  level: Level
  walls: Set<number>
}

export interface Mechanic {
  id: MechanicId
  hooks: {
    resolveMove?: (pos: Pos, dir: Pos, ctx: MoveCtx) => Pos
    mergedWalls?: (level: Level) => Pos[]
    enablesMerge?: boolean
    extraSuccessors?: (state: GameState, level: Level) => [Input, GameState][]
  }
}
