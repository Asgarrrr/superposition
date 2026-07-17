// A GitHub-style contribution grid for the daily puzzle: one square per UTC day,
// columns are weeks (Monday-first), the shade reads how many tiers the player
// solved that day. The rarest shade — all four tiers, only reachable on a
// weekend — prints in tape amber, the game's "locked / done" seal, so a perfect
// weekend stands out on the sheet. The grid always fills a fixed minimum window
// so it reads as a full sheet even with only a handful of prints on it.

import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { buildWeeks } from "../../lib/contribGrid.ts";
import type { DailyHistory } from "../../server/profile.ts";

// index by tiers-solved (0–4); 0 is the empty base, 4 the amber lock. Empty is
// kept faintly visible so the grid still reads as a grid on a nearly blank sheet.
const SHADE = [
  "bg-paper/[0.07]",
  "bg-paper/25",
  "bg-paper/45",
  "bg-paper/70",
  "bg-tape/90",
] as const;

export function ContributionGraph({
  history,
  today,
}: {
  history: DailyHistory;
  today: string;
}) {
  const weeks = buildWeeks(history.days, history.joinedAt, today);
  const locale = getLocale();
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const full = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  // a month label sits above the first column whose month differs from the one
  // labelled before it, mirroring GitHub's sparse month axis
  let lastMonth = "";
  const labels = weeks.map((col) => {
    const first = col.find((c) => !c.spacer);
    if (!first) return "";
    const key = first.date.slice(0, 7);
    if (key === lastMonth) return "";
    lastMonth = key;
    return month.format(new Date(`${first.date}T00:00:00Z`));
  });

  // weekday axis: Mon/Wed/Fri only (rows 0/2/4), from a reference Monday
  const dayLabel = (row: number) =>
    row % 2 === 0 && row < 6
      ? weekday.format(new Date(Date.UTC(2024, 0, 1 + row))) // 2024-01-01 = Monday
      : "";

  return (
    <div className="overflow-x-auto">
      <div className="flex w-max gap-2">
        <div className="flex flex-col gap-[3px] pt-[21px]">
          {[0, 1, 2, 3, 4, 5, 6].map((row) => (
            <span
              key={row}
              className="h-[15px] pr-0.5 text-right font-mono text-[9px] leading-[15px] text-paper/30"
            >
              {dayLabel(row)}
            </span>
          ))}
        </div>
        <div className="flex w-max flex-col gap-1.5">
          <div className="flex h-[15px] gap-[3px]">
            {labels.map((label, i) => (
              <span
                key={i}
                className="w-[15px] font-mono text-[9px] text-paper/40"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((cell, j) =>
                  cell.spacer ? (
                    <div key={j} className="size-[15px]" />
                  ) : (
                    <div
                      key={j}
                      className={`size-[15px] rounded-[3px] ring-inset transition-shadow hover:ring-1 hover:ring-paper/50 ${SHADE[cell.count] ?? SHADE[4]}`}
                      title={`${full.format(new Date(`${cell.date}T00:00:00Z`))} · ${cell.count}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 self-end font-mono text-[9px] text-paper/40">
            <span>{m.profile_less()}</span>
            {SHADE.map((shade, i) => (
              <span key={i} className={`size-[13px] rounded-[3px] ${shade}`} />
            ))}
            <span>{m.profile_more()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
