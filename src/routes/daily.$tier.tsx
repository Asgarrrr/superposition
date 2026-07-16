// One tier of the day's challenge, addressed by its tier index (/daily/2).
// The three tiers are launched from the yellow "défi du jour" box on /levels;
// each has its own shared leaderboard. Owns its own sound like the level route.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getDailyPuzzle } from "../server/daily.ts";
import { PlayScreen } from "../ui/screens/PlayScreen.tsx";
import { usePersistedSound } from "../ui/hooks/useSound.ts";

export const Route = createFileRoute("/daily/$tier")({
  // only 0/1/2 are valid tiers; a bad URL bounces to the selector before load
  loader: ({ params }) => {
    if (!/^[012]$/.test(params.tier)) throw redirect({ to: "/levels" });
    return getDailyPuzzle({ data: { tier: Number(params.tier) } });
  },
  component: DailyRoute,
});

function DailyRoute() {
  const { date, tier, level, optimal } = Route.useLoaderData();
  const navigate = useNavigate();
  const { fx, muted, toggleMuted } = usePersistedSound();

  return (
    <PlayScreen
      key={level.id}
      level={level}
      fx={fx}
      muted={muted}
      onToggleMute={toggleMuted}
      onExit={() => navigate({ to: "/levels" })}
      daily={{ date, tier, optimal }}
    />
  );
}
