// The campaign rail: binds LeaderboardRail to a level's board (getLevelBoard /
// submitLevelScore, keyed by the code-side level id). All the shared behavior —
// read, auto-submit, auth gate, standing — lives in LeaderboardRail.

import { useCallback, useMemo } from "react";
import type { Variants } from "motion/react";
import type { TraceStep } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { LeaderboardRail } from "./LeaderboardRail.tsx";
import type { BoardSource } from "./LeaderboardRail.tsx";
import type { Solve } from "../submissionPolicy.ts";
import { getLevelBoard, submitLevelScore } from "../../server/campaign.ts";

export function LevelBoard({
  levelId,
  solve,
  className = "",
  variants,
}: {
  levelId: string;
  solve: Solve | null;
  className?: string;
  variants?: Variants;
}) {
  const read = useCallback(
    () => getLevelBoard({ data: { levelId } }),
    [levelId],
  );
  const submit = useCallback(
    async (trace: TraceStep[]) => {
      await submitLevelScore({ data: { levelId, trace } });
    },
    [levelId],
  );
  const source = useMemo<BoardSource>(
    () => ({
      read,
      submit,
      title: m.level_leaderboard_title(),
      emptyLabel: m.level_leaderboard_empty(),
    }),
    [read, submit],
  );

  return (
    <LeaderboardRail
      source={source}
      solve={solve}
      className={className}
      variants={variants}
    />
  );
}
