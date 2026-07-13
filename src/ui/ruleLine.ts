// The rule line under the light box: one tip at a time,
// chosen by the level's most defining mechanic.

import type { GameState, Level } from '../engine/types.ts'
import { eq } from '../engine/grid.ts'
import { m } from '../paraglide/messages.js'

export function ruleLine(st: GameState, level: Level): string {
  if (level.mods.includes('decalage') && !st.merged)
    return eq(st.off, [0, 0])
      ? m.rule_decalage_aligned()
      : m.rule_decalage_off({ x: st.off[0], y: st.off[1] })
  if (level.mods.includes('glace')) return m.rule_glace()
  if ((level.lightWalls ?? []).length) return m.rule_lightwalls()
  if (level.mods.includes('fusion'))
    return st.merged ? m.rule_fusion_merged() : m.rule_fusion_split()
  return m.rule_base()
}
