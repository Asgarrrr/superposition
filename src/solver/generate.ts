// Generator — `bun run gen -- --mods fusion,scission,glace --size 5 --min 18 --ms 30000`.
// Hunts for levels where each requested mechanic is PROVEN necessary.

import type { Level, MechanicId, Pos } from '../engine/types.ts'
import { fmtInput, solve, solveWithout } from './bfs.ts'

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf('--' + name)
  return i > -1 ? process.argv[i + 1] : dflt
}

const mods = arg('mods', 'fusion,scission').split(',') as MechanicId[]
const size = Number(arg('size', '5'))
const minLen = Number(arg('min', '16'))
const budgetMs = Number(arg('ms', '30000'))

const rnd = (n: number) => Math.floor(Math.random() * n)
const cell = (): Pos => [rnd(size), rnd(size)]
const ck = (p: Pos) => p[0] * size + p[1]

function randomLevel(): Level {
  const aStart = cell()
  const bStart = cell()
  const aGoal = cell()
  const bGoal = Math.random() < 0.4 ? aGoal : cell()
  const mk = (used: Set<number>, count: number): Pos[] => {
    const walls: Pos[] = []
    while (walls.length < count) {
      const p = cell()
      if (!used.has(ck(p))) {
        used.add(ck(p))
        walls.push(p)
      }
    }
    return walls
  }
  const lv: Level = {
    id: 'gen', ch: 'GEN', name: 'gen', size, mods,
    a: { start: aStart, goal: aGoal, walls: mk(new Set([ck(aStart), ck(aGoal)]), size - 2 + rnd(size)) },
    b: { start: bStart, goal: bGoal, walls: mk(new Set([ck(bStart), ck(bGoal)]), size - 2 + rnd(size)) },
  }
  if (mods.includes('lumiere')) lv.lightWalls = mk(new Set(), 1 + rnd(size - 2))
  return lv
}

interface Found {
  lv: Level
  len: number
  sol: string
  proofs: string[]
  score: number
}

const found: Found[] = []
const t0 = Date.now()
let tested = 0

while (Date.now() - t0 < budgetMs) {
  tested++
  const lv = randomLevel()
  const full = solve(lv)
  if (!full || full.inputs.length < minLen) continue
  // proof of necessity: removing each mechanic must make the level unsolvable
  const proofs: string[] = []
  let allEssential = true
  for (const m of mods) {
    const removed: MechanicId[] = m === 'fusion' ? ['fusion', 'scission'] : [m]
    if (solveWithout(lv, removed) === null) proofs.push(m + ' obligatoire')
    else if (m === 'fusion' || m === 'scission' || m === 'decalage') {
      allEssential = false
      break
    }
    // ice / light: not required to be mandatory, they already change the texture
  }
  if (!allEssential) continue
  found.push({
    lv,
    len: full.inputs.length,
    sol: full.inputs.map(fmtInput).join(' '),
    proofs,
    score: full.inputs.length + proofs.length * 5,
  })
}

found.sort((a, b) => b.score - a.score)
console.log(`mods=[${mods}] size=${size} · testés ${tested} · retenus ${found.length}\n`)
for (const f of found.slice(0, 5)) {
  console.log(`score ${f.score} · ${f.len} coups · ${f.proofs.join(', ')}`)
  console.log(`  a: ${JSON.stringify(f.lv.a)}`)
  console.log(`  b: ${JSON.stringify(f.lv.b)}`)
  if (f.lv.lightWalls) console.log(`  lumière: ${JSON.stringify(f.lv.lightWalls)}`)
  console.log(`  sol: ${f.sol}\n`)
}
