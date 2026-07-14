// Game banner: navigation, sound, level name, move counter, hint.

import type { Level } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { levelHint } from "../copy.ts";

export function Hud({
  plate,
  total,
  level,
  moves,
  muted,
  onToggleMute,
  onExit,
  daily,
  backLabel,
}: {
  plate: number; // level number, 1-based
  total: number;
  level: Level;
  moves: number;
  muted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
  daily?: string; // when set (a YYYY-MM-DD date), show the daily banner instead of plate/total
  backLabel?: string;
}) {
  return (
    <div className="mb-4 flex w-[min(92vw,420px)] flex-col gap-1 border-b border-paper/10 pb-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn border-none p-0 text-[11px] text-paper/28 transition-colors hover:text-paper/55"
          onClick={onExit}
        >
          ← {backLabel ?? m.hud_back()}
        </button>
        <button
          type="button"
          className="btn border-none p-0 text-[11px] text-paper/28 transition-colors hover:text-paper/55"
          onClick={onToggleMute}
        >
          {muted ? m.hud_sound_off() : m.hud_sound_on()}
        </button>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="font-display text-[26px] italic tracking-[0.02em]">
          <span className="mr-2.5 font-mono text-[11px] not-italic tracking-[0.12em] text-paper/35 tabular-nums">
            {daily ?? `${String(plate).padStart(2, "0")}/${total}`}
          </span>
          {daily ? m.daily_tag() : level.name}
        </div>
        <div className="font-mono text-xs text-paper/50">
          <span className="text-paper/75 tabular-nums">{moves}</span>{" "}
          <span className="text-paper/28">
            {m.hud_moves_word({ count: moves })}
          </span>
        </div>
      </div>
      <div className="font-display text-xs italic tracking-[0.02em] text-paper/35">
        {levelHint(level.id)}
      </div>
    </div>
  );
}
