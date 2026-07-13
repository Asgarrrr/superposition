// Directional pad + alternate gestures (split / world), undo, reset.

import type { Pos } from '../../engine/types.ts'
import { m } from '../../paraglide/messages.js'

export function Controls({ altLabel, altArmed, onDir, onToggleAlt, onUndo, onReset }: {
  altLabel: string | null // null: no alternate gesture on this level
  altArmed: boolean
  onDir: (d: Pos) => void
  onToggleAlt: () => void
  onUndo: () => void
  onReset: () => void
}) {
  const dir = (d: Pos, glyph: string) => (
    <button type="button" className="btn h-[54px] w-[54px] p-0 text-lg text-paper" onClick={() => onDir(d)}>
      {glyph}
    </button>
  )
  // action button: label on the left, engraved keycap on the right
  const action = (label: string, key: string, onClick: () => void, extra = '') => (
    <button type="button" className={`btn flex w-[136px] items-center ${extra}`} onClick={onClick}>
      <span>{label}</span>
      <kbd className="kbd ml-auto">{key}</kbd>
    </button>
  )
  return (
    <div className="mt-4 flex items-center gap-6.5">
      <div className="grid grid-cols-[repeat(3,54px)] gap-1.5">
        <div />
        {dir([-1, 0], '↑')}
        <div />
        {dir([0, -1], '←')}
        {dir([1, 0], '↓')}
        {dir([0, 1], '→')}
      </div>
      <div className="flex flex-col gap-2">
        {altLabel &&
          action(
            altArmed ? `${altLabel}${m.controls_arm()}` : altLabel,
            '⇧',
            onToggleAlt,
            altArmed ? 'border-tape bg-tape/8 text-tape' : 'border-paper/30',
          )}
        {action(m.controls_undo(), 'Z', onUndo)}
        {action(m.controls_reset(), 'R', onReset)}
      </div>
    </div>
  )
}
