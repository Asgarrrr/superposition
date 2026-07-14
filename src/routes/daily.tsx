// The daily level: everyone plays the same puzzle each UTC day. Loaded from the
// server (getDailyPuzzle), played through PlayScreen in daily mode. Sound/mute
// are owned here, mirroring App.tsx — this route lives outside App's shell.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getDailyPuzzle } from "../server/daily.ts";
import { PlayScreen } from "../ui/screens/PlayScreen.tsx";
import { usePersistedSound } from "../ui/hooks/useSound.ts";

export const Route = createFileRoute("/daily")({
  loader: () => getDailyPuzzle(),
  component: DailyRoute,
});

function DailyRoute() {
  const { date, level, optimal } = Route.useLoaderData();
  const navigate = useNavigate();
  const { fx, muted, toggleMuted } = usePersistedSound();

  return (
    <PlayScreen
      key={level.id}
      level={level}
      fx={fx}
      muted={muted}
      onToggleMute={toggleMuted}
      onExit={() => navigate({ to: "/" })}
      daily={{ date, optimal }}
    />
  );
}
