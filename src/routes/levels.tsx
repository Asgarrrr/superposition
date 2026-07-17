import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SelectScreen } from "../ui/screens/SelectScreen.tsx";
import { useBestScores } from "../ui/hooks/useBestScores.ts";
import { getWeekendDaily } from "../server/daily.ts";
import { useSession } from "../lib/auth-client.ts";
import { clearReveal, peekReveal } from "../ui/transition.ts";

// Level select — the edition of plates. Picking one routes to /level/$plate.
export const Route = createFileRoute("/levels")({ component: SelectRoute });

function SelectRoute() {
  const navigate = useNavigate();
  const { best } = useBestScores();
  const { data: session } = useSession();
  // read the enter-screen hand-off once, on the first render (pure — no
  // mutation), latched in a ref; then clear it after commit so a plain return
  // to the selector never replays the reveal
  const reveal = useRef<boolean | null>(null);
  if (reveal.current === null) reveal.current = peekReveal();
  useEffect(() => clearReveal(), []);

  // the weekend épreuve plate is shown only when the server actually has one
  // (a weekend AND the cron certified it) — so it never dead-ends on a click
  const [weekendReady, setWeekendReady] = useState(false);
  useEffect(() => {
    let alive = true;
    getWeekendDaily()
      .then((p) => alive && setWeekendReady(p !== null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SelectScreen
      best={best}
      reveal={reveal.current}
      weekendReady={weekendReady}
      signedIn={!!session}
      onProfile={() => navigate({ to: "/profile/me" })}
      onPick={(i) =>
        navigate({ to: "/level/$plate", params: { plate: String(i + 1) } })
      }
      onDaily={(tier) =>
        navigate({ to: "/daily/$tier", params: { tier: String(tier) } })
      }
    />
  );
}
