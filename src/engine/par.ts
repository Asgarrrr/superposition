// ─── Par ─────────────────────────────────────────────────────
// Solver-certified optima: the fewest inputs that solve each board,
// as measured by the rule-agnostic BFS. Derived data, transcribed
// from `bun run verify` — which re-solves every board and asserts
// these on each run, so a stale or wrong entry fails the build.
// Kept apart from levels.ts (pure geometry) so the two can't drift.

export const PAR: Record<string, number> = {
  accord: 4,
  retenue: 4,
  croisee: 12,
  ecart: 6,
  rdv: 9,
  blanc: 8,
  traversee: 10,
  diffraction: 11,
  trouvaille: 21,
  abysse: 22,
  eclipse: 19,
  echange: 20,
  trinite: 23,
  verglas: 26,
  derive: 22,
  tectonique: 23,
  reflet: 8,
  envers: 15,
  parallaxe: 20,
  goupille: 14,
  aplomb: 19,
  calage: 23,
}
