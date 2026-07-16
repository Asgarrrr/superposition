import { describe, expect, it } from 'vitest'
import { hunt } from './hunt.ts'
import { levelSignature } from './signature.ts'

const EASY = { mods: ['fusion', 'scission'] as const, size: 5, minLen: 8 }

describe('hunt — signatures et dedup', () => {
  it('chaque Found porte la signature de son niveau', () => {
    const { found } = hunt({ ...EASY, budgetMs: 1500 })
    expect(found.length).toBeGreaterThan(0)
    for (const f of found) expect(f.sig).toBe(levelSignature(f.lv))
  })

  it('ne renvoie jamais un niveau dont la signature est dans `seen`', () => {
    const first = hunt({ ...EASY, budgetMs: 1500 })
    const seen = new Set(first.found.map((f) => f.sig))
    const second = hunt({ ...EASY, budgetMs: 1500, seen })
    for (const f of second.found) expect(seen.has(f.sig)).toBe(false)
  })
})

describe('hunt — early-exit', () => {
  it('sans stopAtLen épuise le budget ; avec, rend la main bien avant', () => {
    const budgetMs = 2000

    const t0 = Date.now()
    hunt({ ...EASY, budgetMs })
    const full = Date.now() - t0

    const t1 = Date.now()
    const early = hunt({ ...EASY, budgetMs, stopAtLen: EASY.minLen })
    const stopped = Date.now() - t1

    expect(full).toBeGreaterThanOrEqual(budgetMs - 50) // a tourné tout le budget
    expect(stopped).toBeLessThan(budgetMs) // s'est arrêté avant la fin
    expect(early.found.length).toBeGreaterThan(0)
    for (const f of early.found) expect(f.len).toBeGreaterThanOrEqual(EASY.minLen)
  })
})
