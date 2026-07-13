// Shared light-box geometry (SVG viewBox for the layers and the overlay).

import type { Pos } from '../../engine/types.ts'

export const CELL = 56
export const PAD = 26

/** Side of the viewBox for a grid of `size` cells. */
export const boardSpan = (size: number) => size * CELL + PAD * 2

/** Center of a cell in viewBox coordinates. */
export const cellCenter = (p: Pos): [number, number] => [
  PAD + p[1] * CELL + CELL / 2,
  PAD + p[0] * CELL + CELL / 2,
]
