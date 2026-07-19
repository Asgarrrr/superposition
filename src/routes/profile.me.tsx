// The signed-in player's own page (/profile/me): streak figures and a
// GitHub-style grid of daily completions. Data is private, so there's no loader
// — the component gates on the session and fetches the history only once signed
// in (SSR is off, same client-only pattern as the weekend plate on /levels).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { m } from "../paraglide/messages.js";
import { getMyDailyHistory, type DailyHistory } from "../server/profile.ts";
import { useSession } from "../lib/auth-client.ts";
import { utcDay } from "../lib/day.ts";
import { ProfileScreen } from "../ui/screens/ProfileScreen.tsx";
import { AuthPanel } from "../ui/components/AuthPanel.tsx";
import { Room } from "../ui/components/Room.tsx";
import { reducedMotion as reduced } from "../ui/motion.ts";

export const Route = createFileRoute("/profile/me")({ component: MeRoute });

function MeRoute() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const uid = session?.user.id;

  const [history, setHistory] = useState<DailyHistory | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!uid) {
      setHistory(null);
      setFailed(false);
      return;
    }
    let alive = true;
    setFailed(false);
    getMyDailyHistory()
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [uid]);

  const back = () => navigate({ to: "/levels" });

  // signed in with history loaded — the real page
  if (session && history)
    return <ProfileScreen history={history} today={utcDay()} onBack={back} />;

  // the fetch failed while signed in — offer a way out rather than a dead-end
  // blank table (a transient error would otherwise strand the page forever)
  if (session && failed)
    return (
      <div className="relative flex min-h-dvh items-center justify-center font-mono text-paper select-none">
        <Room variant={0} reduced={reduced} />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <p className="text-[11px] tracking-[0.1em] text-ink-magenta">
            {m.daily_submit_error()}
          </p>
          <button
            type="button"
            onClick={back}
            className="cursor-pointer text-[11px] tracking-[0.2em] text-paper/40 uppercase transition-colors hover:text-paper/70"
          >
            ← {m.daily_back()}
          </button>
        </div>
      </div>
    );

  // pending session or first fetch in flight: hold the lit table, no flash of
  // the sign-in gate before we know whether there's a session
  if (isPending || (uid && !history))
    return (
      <div className="relative min-h-dvh">
        <Room variant={0} reduced={reduced} />
      </div>
    );

  // no session — the sign-in gate
  return (
    <div className="relative flex min-h-dvh items-center justify-center font-mono text-paper select-none">
      <Room variant={0} reduced={reduced} />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <p className="text-[11px] tracking-[0.1em] text-paper/50">
          {m.profile_signin_prompt()}
        </p>
        <AuthPanel />
        <button
          type="button"
          onClick={back}
          className="cursor-pointer text-[11px] tracking-[0.2em] text-paper/40 uppercase transition-colors hover:text-paper/70"
        >
          ← {m.daily_back()}
        </button>
      </div>
    </div>
  );
}
