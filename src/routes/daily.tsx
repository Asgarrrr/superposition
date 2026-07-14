// The daily level: everyone plays the same puzzle each UTC day. Loaded from the
// server (getDailyPuzzle), played through PlayScreen in daily mode. Sound/mute
// are owned here, mirroring App.tsx — this route lives outside App's shell.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getDailyPuzzle } from "../server/daily.ts";
import { PlayScreen } from "../ui/screens/PlayScreen.tsx";
import { useSound } from "../ui/hooks/useSound.ts";

export const Route = createFileRoute("/daily")({
  loader: () => getDailyPuzzle(),
  component: DailyRoute,
});

function DailyRoute() {
  const { date, level, optimal } = Route.useLoaderData();
  const navigate = useNavigate();
  const [muted, setMutedState] = useState(false);
  const { fx, setMuted } = useSound();

  return (
    <PlayScreen
      key={level.id}
      level={level}
      fx={fx}
      muted={muted}
      onToggleMute={() => {
        setMuted(!muted);
        setMutedState(!muted);
      }}
      onExit={() => navigate({ to: "/" })}
      daily={{ date, optimal }}
    />
  );
}
