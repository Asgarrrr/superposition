// Game keyboard: arrows (Shift = alternate gesture), z/u undo,
// r reset, s/x arm, Esc to levels, Enter next level.

import { useEffect, useRef } from 'react'
import type { Pos } from '../../engine/types.ts'

const DIRS: Record<string, Pos> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

export interface KeyHandlers {
  play: (dir: Pos, wantAlt: boolean) => void
  undo: () => void
  reset: () => void
  toggleAlt: () => void
  exit: () => void
  next: () => void // no-op if the level is not solved
}

export function useKeyboard(handlers: KeyHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current
      const dir = DIRS[e.key]
      if (dir) {
        e.preventDefault()
        h.play(dir, e.shiftKey)
      } else if (e.key === 'z' || e.key === 'u') h.undo()
      else if (e.key === 'r') h.reset()
      else if (e.key === 's' || e.key === 'x') h.toggleAlt()
      else if (e.key === 'Escape') h.exit()
      else if (e.key === 'Enter') h.next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
