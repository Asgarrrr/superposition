import type { Mechanic } from '../types.ts'

/** White squares only block the merged pawn — the inks pass through them. */
export const lumiere: Mechanic = {
  id: 'lumiere',
  hooks: { mergedWalls: (level) => level.lightWalls ?? [] },
}
