// A GitHub-style contribution grid for the daily puzzle: one calendar year of
// squares, columns are weeks (Monday-first), the shade reads how many tiers the
// player solved that day. The rarest shade — all four tiers, only reachable on a
// weekend — prints in tape amber, the game's "locked / done" seal. Year tabs
// switch between the years the account spans; the grid is always shown, so a
// blank year still reads as a timeline waiting to be filled.

import { useMemo, useState } from "react";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import {
  availableYears,
  buildYear,
  SHADE_CLASSES as SHADE,
} from "../../lib/contribGrid.ts";
import type { DailyHistory } from "../../server/profile.ts";

export function ContributionGraph({
  history,
  today,
}: {
  history: DailyHistory;
  today: string;
}) {
  const years = availableYears(history.joinedAt, today);
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));

  const weeks = buildYear(history.days, year, today);
  const locale = getLocale();
  // formatters are pure in `locale`; memoise so a year-tab click doesn't rebuild
  // three ICU instances before laying out ~53 columns
  const { month, weekday, full } = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(locale, {
        month: "short",
        timeZone: "UTC",
      }),
      weekday: new Intl.DateTimeFormat(locale, {
        weekday: "short",
        timeZone: "UTC",
      }),
      full: new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    }),
    [locale],
  );

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
    <div className="flex flex-col gap-2.5">
      {years.length > 1 && (
        <div className="flex flex-wrap justify-end gap-2 font-mono text-[11px] tracking-wide">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`cursor-pointer tabular-nums transition-colors ${
                y === year ? "text-tape" : "text-paper/35 hover:text-paper/70"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex w-max gap-2">
          <div className="flex flex-col gap-[2px] pt-[18px]">
            {[0, 1, 2, 3, 4, 5, 6].map((row) => (
              <span
                key={row}
                className="h-[12px] pr-0.5 text-right font-mono text-[9px] leading-[12px] text-paper/30"
              >
                {dayLabel(row)}
              </span>
            ))}
          </div>
          <div className="flex w-max flex-col gap-1.5">
            <div className="flex h-[12px] gap-[2px]">
              {labels.map((label, i) => (
                <span
                  key={i}
                  className="w-[12px] font-mono text-[9px] whitespace-nowrap text-paper/40"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="flex gap-[2px]">
              {weeks.map((col, i) => (
                <div key={i} className="flex flex-col gap-[2px]">
                  {col.map((cell, j) =>
                    cell.spacer ? (
                      <div key={j} className="size-[12px]" />
                    ) : (
                      <div
                        key={j}
                        className={`size-[12px] rounded-[2px] ring-inset transition-shadow hover:ring-1 hover:ring-paper/50 ${SHADE[cell.count] ?? SHADE[4]}`}
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
                <span
                  key={i}
                  className={`size-[11px] rounded-[2px] ${shade}`}
                />
              ))}
              <span>{m.profile_more()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
