// The registry — to add a mechanic: a file alongside, an entry here,
// its id in MechanicId (types.ts). Nothing else to touch on the engine side.

import type { Level, Mechanic, MechanicId } from '../types.ts'
import { decalage } from './decalage.ts'
import { fusion } from './fusion.ts'
import { glace } from './glace.ts'
import { lumiere } from './lumiere.ts'
import { scission } from './scission.ts'

export const MECHANICS: Record<MechanicId, Mechanic> = {
  glace,
  fusion,
  scission,
  lumiere,
  decalage,
}

export const active = (level: Level): Mechanic[] => level.mods.map((id) => MECHANICS[id])
