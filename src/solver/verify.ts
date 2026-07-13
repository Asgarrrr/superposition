// Level bank verification — `bun run verify`.
// Rejects any unsolvable level and measures difficulty.

import { LEVELS } from '../engine/levels.ts'
import { fmtInput, solve, solveWithout } from './bfs.ts'

let failed = false
for (const lv of LEVELS) {
  const sol = solve(lv)
  if (!sol) {
    console.error(`✗ ${lv.id} : INSOLUBLE`)
    failed = true
    continue
  }
  const needsFusion = lv.mods.includes('fusion') && solveWithout(lv, ['fusion', 'scission']) === null
  const needsSplit = lv.mods.includes('scission') && solveWithout(lv, ['scission']) === null
  const tags = [
    needsFusion ? 'fusion obligatoire' : '',
    needsSplit ? 'scission obligatoire' : '',
  ].filter(Boolean).join(', ')
  console.log(
    `✓ ${lv.ch.padEnd(3)} ${lv.name.padEnd(12)} ${String(sol.inputs.length).padStart(2)} coups` +
    (tags ? `  [${tags}]` : '') +
    `  ${sol.inputs.map(fmtInput).join(' ')}`,
  )
}
process.exit(failed ? 1 : 0)
