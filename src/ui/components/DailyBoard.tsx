// The daily rail: binds LeaderboardRail to the day's board (getDailyBoard /
// submitDailyScore, keyed by date). All the shared behavior — read, auto-submit,
// auth gate, standing — lives in LeaderboardRail.

import { useCallback, useMemo } from "react";
import type { Variants } from "motion/react";
import type { TraceStep } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { LeaderboardRail } from "./LeaderboardRail.tsx";
import type { BoardSource } from "./LeaderboardRail.tsx";
import { getDailyBoard, submitDailyScore } from "../../server/daily.ts";

export function DailyBoard({
  date,
  tier,
  solved,
  moves,
  wonTrace,
  className = "",
  variants,
}: {
  date: string;
  tier: number;
  solved: boolean;
  moves: number;
  wonTrace: TraceStep[];
  className?: string;
  variants?: Variants;
}) {
  const submit = useCallback(
    async (trace: TraceStep[]) => {
      await submitDailyScore({ data: { trace, date, tier } });
    },
    [date, tier],
  );
  const source = useMemo<BoardSource>(
    () => ({
      read: () => getDailyBoard({ data: { date, tier } }),
      submit,
      title: m.daily_leaderboard_title(),
      emptyLabel: m.daily_leaderboard_empty(),
    }),
    [submit, date, tier],
  );

  return (
    <LeaderboardRail
      source={source}
      solved={solved}
      moves={moves}
      wonTrace={wonTrace}
      className={className}
      variants={variants}
    />
  );
}
