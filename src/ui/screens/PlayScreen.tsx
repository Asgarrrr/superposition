// The play screen: composes Hud, Board, rule line and Controls
// around useGame. Remounted (key) on every level change.

import type { Level } from '../../engine/types.ts'
import { m } from '../../paraglide/messages.js'
import { ruleLine } from '../ruleLine.ts'
import { Board } from '../components/Board.tsx'
import { Controls } from '../components/Controls.tsx'
import { Hud } from '../components/Hud.tsx'
import { WinOverlay } from '../components/WinOverlay.tsx'
import { useGame } from '../hooks/useGame.ts'
import { useKeyboard } from '../hooks/useKeyboard.ts'
import type { SoundFx } from '../hooks/useSound.ts'
import { useSwipe } from '../hooks/useSwipe.ts'

export function PlayScreen({ level, plate, total, best, fx, muted, onToggleMute, onWin, onNext, onExit }: {
  level: Level
  plate: number // level number, 1-based
  total: number
  best: number | undefined
  fx: SoundFx
  muted: boolean
  onToggleMute: () => void
  onWin: (moves: number) => void
  onNext: (() => void) | null
  onExit: () => void
}) {
  const game = useGame(level, fx, onWin)
  const swipe = useSwipe(game.play)

  useKeyboard({
    play: game.play,
    undo: game.undo,
    reset: game.reset,
    toggleAlt: game.toggleAlt,
    exit: onExit,
    next: () => {
      if (game.solved) onNext?.()
    },
  })

  const altLabel = game.st.merged
    ? m.controls_split()
    : level.mods.includes('decalage')
      ? m.controls_world()
      : null

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-room px-4 pt-6 pb-10 font-mono text-paper select-none">
      <div className="grain fixed inset-0" />

      <Hud plate={plate} total={total} level={level} moves={game.moves}
        muted={muted} onToggleMute={onToggleMute} onExit={onExit} />

      <Board level={level} st={game.st} solved={game.solved} bump={game.bump} bloom={game.bloom}
        iceTrailA={game.iceTrailA} iceTrailB={game.iceTrailB} {...swipe}>
        {game.solved && (
          <WinOverlay plate={plate} moves={game.moves} best={best} onNext={onNext} />
        )}
      </Board>

      <div className="mt-3.5 min-h-[30px] max-w-[400px] text-center text-[11.5px] tracking-[0.02em] text-paper/28">
        {game.flash ? <span className="text-ink-magenta">{game.flash}</span> : ruleLine(game.st, level)}
      </div>

      <Controls altLabel={altLabel} altArmed={game.altArmed} onDir={game.play}
        onToggleAlt={game.toggleAlt} onUndo={game.undo} onReset={game.reset} />
    </div>
  )
}
