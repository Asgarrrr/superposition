import type { Mechanic } from '../types.ts'

/**
 * A merge is a BOARD event: it happens when a == b + off.
 * The merged pawn passes through ink walls (only light stops it).
 */
export const fusion: Mechanic = {
  id: 'fusion',
  hooks: { enablesMerge: true },
}
