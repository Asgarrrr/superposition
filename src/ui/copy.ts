// UI-only text resolved by key against the i18n messages: level hints
// (kept out of the engine's pure level data) and chapter names. Paraglide
// tree-shakes on static references, so the lookups are explicit maps.

import { m } from '../paraglide/messages.js'

const HINTS: Record<string, () => string> = {
  accord: m.hint_accord,
  retenue: m.hint_retenue,
  croisee: m.hint_croisee,
  ecart: m.hint_ecart,
  rdv: m.hint_rdv,
  blanc: m.hint_blanc,
  traversee: m.hint_traversee,
  diffraction: m.hint_diffraction,
  trouvaille: m.hint_trouvaille,
  abysse: m.hint_abysse,
  eclipse: m.hint_eclipse,
  echange: m.hint_echange,
  trinite: m.hint_trinite,
  verglas: m.hint_verglas,
  derive: m.hint_derive,
  tectonique: m.hint_tectonique,
  reflet: m.hint_reflet,
  envers: m.hint_envers,
  parallaxe: m.hint_parallaxe,
  goupille: m.hint_goupille,
  aplomb: m.hint_aplomb,
  calage: m.hint_calage,
}

const CHAPTERS: Record<string, () => string> = {
  I: m.chapter_I,
  II: m.chapter_II,
  III: m.chapter_III,
  IV: m.chapter_IV,
  V: m.chapter_V,
  VI: m.chapter_VI,
  VII: m.chapter_VII,
  VIII: m.chapter_VIII,
}

export const levelHint = (id: string): string => HINTS[id]?.() ?? ''
export const chapterName = (ch: string): string => CHAPTERS[ch]?.() ?? ''
