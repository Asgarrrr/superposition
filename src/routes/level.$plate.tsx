// A single level, addressed by its 1-based plate number (/level/3). Owns its
// own sound like the daily route; mute persists across levels via useMuted.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LEVELS } from "../engine/levels.ts";
import { PlayScreen } from "../ui/screens/PlayScreen.tsx";
import { useBestScores } from "../ui/hooks/useBestScores.ts";
import { usePersistedSound } from "../ui/hooks/useSound.ts";

export const Route = createFileRoute("/level/$plate")({ component: PlayRoute });

function PlayRoute() {
  const { plate } = Route.useParams();
  const navigate = useNavigate();
  const idx = Number(plate) - 1;
  const level = LEVELS[idx];
  // only a canonical 1-based index is valid; reject "1e1", "0x0a", "1.0", "01"…
  // (Number() would resolve those to a real-but-mismatched plate)
  const valid = level !== undefined && String(idx + 1) === plate;

  const { best, record, markHinted } = useBestScores();
  const { fx, muted, toggleMuted } = usePersistedSound();

  // an out-of-range or non-canonical plate (bad URL) bounces to the selector
  useEffect(() => {
    if (!valid) navigate({ to: "/levels", replace: true });
  }, [valid, navigate]);
  if (!level || !valid) return null;

  return (
    <PlayScreen
      key={level.id}
      level={level}
      plate={idx + 1}
      total={LEVELS.length}
      best={best[level.id]}
      fx={fx}
      muted={muted}
      onToggleMute={toggleMuted}
      onWin={(moves) => record(level.id, moves)}
      onHintedWin={() => markHinted(level.id)}
      onNext={
        idx < LEVELS.length - 1
          ? () =>
              navigate({
                to: "/level/$plate",
                params: { plate: String(idx + 2) },
              })
          : null
      }
      onExit={() => navigate({ to: "/levels" })}
    />
  );
}
