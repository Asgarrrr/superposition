// The ranked list shared by both leaderboards (the daily win overlay and the
// per-level rail): rank, name (with a "· you" badge on your row), move count,
// and the amber highlight on your own entry. Callers own the surrounding title
// and container; this owns only the rows and the empty state.

import { m } from "../../paraglide/messages.js";
import type { LeaderRow } from "../../server/daily.ts";

export function LeaderboardRows({
  rows,
  uid,
  emptyLabel,
  limit,
  listClassName = "",
}: {
  rows: LeaderRow[];
  uid?: string;
  emptyLabel: string;
  limit?: number; // cap the visible rows (the rail shows a short list)
  listClassName?: string; // extra classes on the <ol> (e.g. a scroll cap)
}) {
  if (rows.length === 0)
    return (
      <p className="py-2 text-center text-[11px] text-paper/30">{emptyLabel}</p>
    );

  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <ol className={`flex flex-col gap-0.5 font-mono ${listClassName}`}>
      {shown.map((r) => (
        <li
          key={r.userId}
          className={`flex items-baseline justify-between text-[12px] ${
            r.userId === uid ? "text-tape" : "text-paper/70"
          }`}
        >
          <span className="w-5 shrink-0 tabular-nums text-paper/35">
            {String(r.rank).padStart(2, "0")}
          </span>
          <span className="mx-2 flex-1 truncate">
            {r.name}
            {r.userId === uid ? ` · ${m.daily_you()}` : ""}
          </span>
          <span className="flex shrink-0 items-baseline gap-1.5">
            {r.clean && (
              // "sans repentir" seal — the two inks laid in perfect register:
              // the game's own superposition, screen-blended so the overlap
              // prints light. A clean pull, in one pass.
              <svg
                width="11"
                height="11"
                viewBox="0 0 14 14"
                className="shrink-0 translate-y-[1px]"
                role="img"
                aria-label={m.clean_solve()}
              >
                <title>{m.clean_solve()}</title>
                <g style={{ mixBlendMode: "screen" }}>
                  <circle
                    cx="5.4"
                    cy="7"
                    r="3.4"
                    fill="var(--color-ink-cyan)"
                  />
                  <circle
                    cx="8.6"
                    cy="7"
                    r="3.4"
                    fill="var(--color-ink-magenta)"
                  />
                </g>
              </svg>
            )}
            <span className="tabular-nums">{r.moves}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
