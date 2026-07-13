// "Ready to print": dark veil, aligned wordmark, amber stamp.

import { Wordmark } from './Wordmark.tsx'
import { m } from '../../paraglide/messages.js'

export function WinOverlay({ plate, moves, best, onNext }: {
  plate: number // level number, 1-based
  moves: number
  best: number | undefined
  onNext: (() => void) | null
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-room/80 backdrop-blur-xs">
      <div className="scale-72">
        <Wordmark aligned size={36} />
      </div>
      <div
        className="rounded-sm border-[2.5px] border-tape px-4.5 py-2 font-mono text-[13px] tracking-[0.28em] text-tape uppercase"
        style={{ animation: 'sp-stamp 700ms cubic-bezier(0.2,1.4,0.4,1) 550ms both' }}
      >
        {m.win_stamp()}
      </div>
      <div className="font-mono text-[11px] tracking-[0.15em] text-paper/50">
        {m.win_summary({ plate: String(plate).padStart(2, '0'), count: moves })}
        {best !== undefined && best < moves ? m.win_record({ best }) : ''}
      </div>
      {onNext ? (
        <button type="button" className="btn border-paper/40 text-paper" onClick={onNext}>
          {m.win_next()}
        </button>
      ) : (
        <div className="font-display text-xs italic text-paper/50">
          {m.win_complete()}
        </div>
      )}
    </div>
  )
}
