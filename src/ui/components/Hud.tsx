// Game banner: navigation, sound, level name, move counter, hint.

import type { Level } from '../../engine/types.ts'
import { m } from '../../paraglide/messages.js'
import { levelHint } from '../copy.ts'

export function Hud({ plate, total, level, moves, muted, onToggleMute, onExit }: {
  plate: number // level number, 1-based
  total: number
  level: Level
  moves: number
  muted: boolean
  onToggleMute: () => void
  onExit: () => void
}) {
  return (
    <div className="mb-4 flex w-[min(92vw,420px)] flex-col gap-1">
      <div className="flex items-center justify-between">
        <button type="button" className="btn border-none p-0 text-[11px] text-paper/28" onClick={onExit}>
          ← {m.hud_back()}
        </button>
        <button type="button" className="btn border-none p-0 text-[11px] text-paper/28" onClick={onToggleMute}>
          {muted ? m.hud_sound_off() : m.hud_sound_on()}
        </button>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="font-display text-[26px] italic tracking-[0.02em]">
          <span className="mr-2.5 font-mono text-xs not-italic text-paper/28">
            {String(plate).padStart(2, '0')}/{total}
          </span>
          {level.name}
        </div>
        <div className="font-mono text-xs text-paper/50">
          {moves} <span className="text-paper/28">{m.hud_moves_word({ count: moves })}</span>
        </div>
      </div>
      <div className="font-display text-xs italic tracking-[0.02em] text-paper/28">
        {levelHint(level.id)}
      </div>
    </div>
  )
}
