// Server functions for profile pages (RPC, SSR is off). A profile is a player's
// daily-completion history — one entry per UTC day, with the number of tiers
// solved that day. Two entry points: the private `/profile/me` (session-gated)
// and the public `/profile/$username` (readable by anyone, like the leaderboard).
// All db access lives in profileData.ts so it stays out of the client bundle;
// here we only wrap it in server functions and gate the private one on a session.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "../lib/auth.ts";
import {
  historyById,
  historyByUsername,
  type DailyHistory,
} from "./profileData.ts";

export type { DailyHistory };

async function currentUserId(): Promise<string | null> {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}

/** The signed-in player's own history. Throws when unauthenticated. */
export const getMyDailyHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyHistory> => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Not authenticated");
    const history = await historyById(userId);
    if (!history) throw new Error("Not authenticated");
    return history;
  },
);

/** Any player's history by username, or null when no such account. Public — no
 *  session needed, same as reading the leaderboard. */
export const getUserDailyHistory = createServerFn({ method: "GET" })
  .validator((data: unknown): { username: string } => {
    const d = data as { username?: unknown } | null;
    if (typeof d?.username !== "string") throw new Error("invalid username");
    // the format is enforced once, in historyByUsername (a bad handle → null)
    return { username: d.username };
  })
  .handler(({ data }) => historyByUsername(data.username));
