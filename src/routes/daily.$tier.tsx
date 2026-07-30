// One tier of the day's challenge, addressed by its tier index (/daily/2).
// The three tiers are launched from the yellow "défi du jour" box on /levels;
// each has its own shared leaderboard. Owns its own sound like the level route.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { openDaily } from "../server/daily.ts";
import { PlayScreen } from "../ui/screens/PlayScreen.tsx";
import { usePersistedSound } from "../ui/hooks/useSound.ts";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/daily/$tier")({
  // client-only: the board is a live AudioContext/keyboard experience with no
  // shareable head, so its loader runs on the client (the app-wide default is
  // `data-only` for the profile's crawler tags — the game opts back out here).
  ssr: false,
  // The loader OPENS the puzzle: `openDaily` hands over the grid and starts the
  // player's discovery clock in the same call, so the board can never be
  // obtained without the clock (src/server/discovery.ts).
  //
  // `preload: false` is load-bearing, not caution. The router's app-wide
  // `defaultPreload: 'intent'` fires a loader on hover — harmless today, since
  // the daily is entered through buttons calling navigate() and the only <Link>
  // in the app points at profiles, but adding a <Link> here would silently start
  // players' clocks as their mouse crossed the plate. Turning preload off makes
  // the invariant enforced rather than remembered.
  //
  // Re-running the loader is safe: the anchor is written once per (date, tier,
  // player) and read back afterwards, so an exit-and-return re-reads the
  // original time instead of restarting it.
  preload: false,
  // tiers 0-2 always resolve; tier 3 (the weekend épreuve d'artiste) resolves
  // only on Sat/Sun with a generated 6×6 — a weekday or missing one bounces to
  // the selector rather than serving a stand-in. Any other URL bounces too.
  loader: async ({ params }) => {
    if (!/^[0-3]$/.test(params.tier)) throw redirect({ to: "/levels" });
    const tier = Number(params.tier);
    const opened = await openDaily({ data: { tier } });
    if (!opened.puzzle) throw redirect({ to: "/levels" });
    return { ...opened, puzzle: opened.puzzle };
  },
  component: DailyRoute,
  // The loader hits server functions (daily puzzle, leaderboard) — the one part
  // of the app that needs the network. Offline, the SW's navigation fallback
  // serves the "/" shell, the client mounts this route, the loader throws, and
  // we show a clear notice instead of a broken screen. A real server error while
  // online gets an honest generic message, not a false "offline" claim.
  // (Redirects for bad tiers are handled by the router, not here.)
  errorComponent: DailyError,
});

// A dropped connection makes fetch() reject with a TypeError; an offline
// navigator confirms it. Anything else (a 5xx serialized by the server function)
// is a real error the player can't fix by reconnecting.
function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError;
}

function DailyError({ error }: { error: Error }) {
  const navigate = useNavigate();
  const offline = isNetworkError(error);
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center font-mono text-paper">
      <h1 className="font-display text-3xl text-paper/90 italic">
        {offline ? m.offline_daily_title() : m.error_daily_title()}
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-paper/55">
        {offline ? m.offline_daily_body() : m.error_daily_body()}
      </p>
      <button
        type="button"
        onClick={() => navigate({ to: "/levels" })}
        className="btn tracking-[0.2em] text-paper/70 uppercase"
      >
        {m.offline_daily_back()}
      </button>
    </main>
  );
}

function DailyRoute() {
  const { puzzle, servedAt, serverNow } = Route.useLoaderData();
  const { date, tier, level, optimal } = puzzle;
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
      daily={{ date, tier, optimal, servedAt, serverNow }}
    />
  );
}
