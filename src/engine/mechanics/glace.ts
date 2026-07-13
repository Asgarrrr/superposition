import type { Mechanic } from '../types.ts'
import { inBounds } from '../grid.ts'

/** Every move slides until it hits an obstacle (layer walls or the edge). */
export const glace: Mechanic = {
  id: 'glace',
  hooks: {
    resolveMove: (pos, dir, ctx) => {
      let [r, c] = pos
      for (;;) {
        const nr = r + dir[0]
        const nc = c + dir[1]
        if (!inBounds(nr, nc, ctx.level.size) || ctx.walls.has(nr * ctx.level.size + nc))
          return [r, c]
        r = nr
        c = nc
      }
    },
  },
}
