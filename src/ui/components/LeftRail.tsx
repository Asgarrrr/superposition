// The play screen's left margin: navigation (back to boards, level progress),
// the sound toggle, and the player's live move count + record. It mirrors the
// leaderboard on the right so the board sits centred between two columns.
//
// On xl it's a vertical rail the board's height (subgrid: the nav shares the
// Hud's baseline rule at row 1, the big stat readout aligns with the board at
// row 2). Below xl it collapses to the top utility bar above the board, the
// move count folded inline and the big readout hidden.

import { m } from "../../paraglide/messages.js";

export function LeftRail({
  plate,
  total,
  moves,
  record,
  muted,
  onToggleMute,
  onExit,
  daily,
  backLabel,
  className = "",
}: {
  plate: number; // level number, 1-based
  total: number;
  moves: number;
  record?: number | undefined; // the player's best on this board, when known
  muted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
  daily?: string; // when set (a YYYY-MM-DD date), show it instead of level progress
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={`font-mono ${className}`}>
      {/* nav — the shared baseline rule with the Hud and the leaderboard header
          (xl: subgrid row 1, pinned to the row's bottom so the three rules line
          up into one continuous edge). Below xl it's the top utility bar. */}
      <div className="mb-3 flex items-end justify-between gap-3 pb-1 xl:mb-0 xl:self-end xl:border-b xl:border-paper/10 xl:pb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn group flex items-center gap-1.5 border-none p-0 text-[11px] tracking-[0.2em] text-paper/50 uppercase transition-colors hover:text-paper/80"
            onClick={onExit}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {backLabel ?? m.hud_back()}
          </button>
          <span className="h-3 w-px bg-paper/12" aria-hidden />
          {daily ? (
            <span className="text-[11px] tracking-[0.18em] text-paper/40 tabular-nums">
              {daily}
            </span>
          ) : (
            <div className="flex items-baseline gap-2 text-[11px] tabular-nums">
              <span className="tracking-[0.2em] text-paper/28 uppercase">
                {m.hud_level()}
              </span>
              <span className="tracking-[0.16em] text-paper/55">
                {String(plate).padStart(2, "0")}
                <span className="text-paper/25">/{total}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* move count folded inline below xl, where the big readout is hidden */}
          <span className="text-[11px] tabular-nums text-paper/50 xl:hidden">
            {moves}{" "}
            <span className="text-paper/28">
              {m.hud_moves_word({ count: moves })}
            </span>
          </span>
          <button
            type="button"
            className="btn border-none p-0 text-paper/28 transition-colors hover:text-paper/55"
            onClick={onToggleMute}
            aria-label={muted ? m.hud_sound_off() : m.hud_sound_on()}
            aria-pressed={muted}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {muted ? (
                <>
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </>
              ) : (
                <>
                  <path d="M16 9a5 5 0 0 1 0 6" />
                  <path d="M19.5 6a9 9 0 0 1 0 12" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* the big readout — the board's row on xl (subgrid row 2), right-aligned
          toward the board and vertically centred against its height. Desktop
          only: the count folds into the nav bar above on narrower viewports. */}
      <div className="hidden xl:flex xl:flex-col xl:items-end xl:justify-center xl:gap-8">
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] tracking-[0.28em] text-paper/40 uppercase">
            {m.stat_current()}
          </span>
          <span className="text-4xl leading-none text-paper/85 tabular-nums">
            {moves}
          </span>
          <span className="text-[10px] tracking-[0.28em] text-paper/40 uppercase">
            {m.stat_moves()}
          </span>
        </div>

        {record !== undefined && (
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] tracking-[0.28em] text-paper/40 uppercase">
              {m.stat_record()}
            </span>
            <span className="text-2xl leading-none text-paper/55 tabular-nums">
              {record}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
