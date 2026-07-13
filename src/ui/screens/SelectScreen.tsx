// Selection: the full edition, level by level, chapter by chapter.

import { LEVELS } from '../../engine/levels.ts'
import { m } from '../../paraglide/messages.js'
import { chapterName } from '../copy.ts'
import { Wordmark } from '../components/Wordmark.tsx'
import { LangToggle } from '../components/LangToggle.tsx'

export function SelectScreen({ best, onPick }: {
  best: Record<string, number>
  onPick: (idx: number) => void
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center bg-room px-4 pt-9 pb-12 font-mono text-paper select-none">
      <div className="grain fixed inset-0" />
      <LangToggle className="absolute top-4 right-4" />
      <div className="mb-1.5 origin-center scale-55">
        <Wordmark aligned />
      </div>
      <div className="mb-7.5 text-[10px] tracking-[0.4em] text-paper/28 uppercase">
        {m.select_edition({ count: LEVELS.length })}
      </div>
      <div className="flex w-[min(92vw,420px)] flex-col gap-2">
        {LEVELS.map((lv, i) => (
          <div key={lv.id} className="flex flex-col">
            {(i === 0 || lv.ch !== LEVELS[i - 1].ch) && (
              <div className="mx-0 mt-4 mb-2 flex items-baseline gap-2.5 text-[10px] tracking-[0.3em] text-paper/28 uppercase">
                <span>{m.select_set({ ch: lv.ch })}</span>
                <span className="flex-1 border-b border-paper/12" />
                <span className="font-display text-[15px] normal-case italic tracking-[0.02em] text-paper/50">
                  {chapterName(lv.ch)}
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn flex items-center gap-3.5 border-paper/14 px-3.5 py-3 text-left"
              onClick={() => onPick(i)}
            >
              <span className="text-[11px] text-paper/28">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 font-display text-sm italic tracking-[0.02em] text-paper">
                {lv.name}
              </span>
              {best[lv.id] !== undefined && (
                <span className="text-[10px] tracking-[0.1em] text-tape">✓ {best[lv.id]}</span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
