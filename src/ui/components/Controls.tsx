// Directional pad + alternate gestures (split / world), undo, reset.

import type { Pos } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";

export function Controls({
  altLabel,
  altArmed,
  onDir,
  onToggleAlt,
  onUndo,
  onReset,
}: {
  altLabel: string | null; // null: no alternate gesture on this level
  altArmed: boolean;
  onDir: (d: Pos) => void;
  onToggleAlt: () => void;
  onUndo: () => void;
  onReset: () => void;
}) {
  // arrow keycap: seated on the light table, presses down under the tip
  const dir = (d: Pos, glyph: string) => (
    <button
      type="button"
      className="btn h-[52px] w-[52px] p-0 text-lg text-paper/75 transition-[color,background-color,border-color,transform] hover:border-paper/30 hover:bg-paper/5 hover:text-paper active:translate-y-px active:bg-paper/8"
      onClick={() => onDir(d)}
    >
      {glyph}
    </button>
  );
  // action button: label on the left, engraved keycap on the right
  const action = (
    label: string,
    key: string,
    onClick: () => void,
    extra = "",
  ) => (
    <button
      type="button"
      className={`btn flex w-[136px] items-center transition-colors ${extra}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <kbd className="kbd ml-auto">{key}</kbd>
    </button>
  );
  const hover = "hover:border-paper/30 hover:text-paper/70";
  return (
    <div className="mt-4 flex items-center gap-6.5">
      <div className="grid grid-cols-[repeat(3,52px)] gap-1.5 rounded-md border border-paper/8 bg-paper/[0.015] p-2">
        <div />
        {dir([-1, 0], "↑")}
        <div />
        {dir([0, -1], "←")}
        {dir([1, 0], "↓")}
        {dir([0, 1], "→")}
      </div>
      <div className="flex flex-col gap-2">
        {altLabel &&
          action(
            altArmed ? `${altLabel}${m.controls_arm()}` : altLabel,
            "⇧",
            onToggleAlt,
            altArmed
              ? "border-tape bg-tape/8 text-tape"
              : `border-paper/30 ${hover}`,
          )}
        {action(m.controls_undo(), "Z", onUndo, hover)}
        {action(m.controls_reset(), "R", onReset, hover)}
      </div>
    </div>
  );
}
