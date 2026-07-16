// One tier of the day's challenge, addressed by its tier index (/daily/2).
// The three tiers are launched from the yellow "défi du jour" box on /levels;
// each has its own shared leaderboard. Owns its own sound like the level route.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getDailyPuzzle, getWeekendDaily } from "../server/daily.ts";
import { PlayScreen } from "../ui/screens/PlayScreen.tsx";
import { usePersistedSound } from "../ui/hooks/useSound.ts";

export const Route = createFileRoute("/daily/$tier")({
  // tiers 0-2 always resolve; tier 3 (the weekend épreuve d'artiste) resolves
  // only on Sat/Sun with a generated 6×6 — a weekday or missing one bounces to
  // the selector rather than serving a stand-in. Any other URL bounces too.
  loader: async ({ params }) => {
    if (!/^[0-3]$/.test(params.tier)) throw redirect({ to: "/levels" });
    const tier = Number(params.tier);
    if (tier === 3) {
      const puzzle = await getWeekendDaily();
      if (!puzzle) throw redirect({ to: "/levels" });
      return puzzle;
    }
    return getDailyPuzzle({ data: { tier } });
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
