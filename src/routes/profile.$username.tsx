// Any player's public page (/profile/$username): the same streak figures and
// contribution grid as /profile/me, but read by username and open to anyone (no
// session needed, like the leaderboard). An unknown or malformed handle bounces
// to the level select rather than dead-ending. Reached from leaderboard names.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getUserDailyHistory } from "../server/profile.ts";
import { computeStreaks } from "../lib/streak.ts";
import { utcDay } from "../lib/day.ts";
import { m } from "../paraglide/messages.js";
import { ProfileScreen } from "../ui/screens/ProfileScreen.tsx";

// `data-only` SSR: the loader runs on the server and the head is rendered into
// the initial HTML, so social crawlers (which don't run JS) get real per-profile
// Open Graph tags — while the client-only ProfileScreen still renders on the
// client, keeping the app's SSR-off contract for everything visual.
export const Route = createFileRoute("/profile/$username")({
  ssr: "data-only",
  loader: async ({ params }) => {
    const history = await getUserDailyHistory({
      data: { username: params.username },
    }).catch(() => null);
    if (!history) throw redirect({ to: "/levels" });
    return history;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const s = computeStreaks(
      loaderData.days.map((d) => d.date),
      utcDay(),
    );
    const title = `${loaderData.name} · Superposition`;
    const description = m.profile_og_description({
      current: s.current,
      longest: s.longest,
      total: s.total,
    });
    // og:image must be absolute; BETTER_AUTH_URL is the app's public origin
    const image = `${process.env.BETTER_AUTH_URL ?? ""}/api/og/${params.username}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: PublicProfileRoute,
});

function PublicProfileRoute() {
  const history = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <ProfileScreen
      history={history}
      today={utcDay()}
      onBack={() => navigate({ to: "/levels" })}
    />
  );
}
