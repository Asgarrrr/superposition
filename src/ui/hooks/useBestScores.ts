// Best scores per level (key = level id), persisted in localStorage.

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'superposition.best'

export function useBestScores() {
  const [best, setBest] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  })

  // persistence lives outside the updater: it must stay pure
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best))
  }, [best])

  const record = (id: string, moves: number) =>
    setBest((b) => {
      const v = Math.min(b[id] ?? Infinity, moves)
      return v === b[id] ? b : { ...b, [id]: v }
    })

  return { best, record }
}
