import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { SelectScreen } from "../ui/screens/SelectScreen.tsx";
import { useBestScores } from "../ui/hooks/useBestScores.ts";
import { clearReveal, peekReveal } from "../ui/transition.ts";

// Level select — the edition of plates. Picking one routes to /level/$plate.
export const Route = createFileRoute("/levels")({ component: SelectRoute });

function SelectRoute() {
  const navigate = useNavigate();
  const { best } = useBestScores();
  // read the enter-screen hand-off once, on the first render (pure — no
  // mutation), latched in a ref; then clear it after commit so a plain return
  // to the selector never replays the reveal
  const reveal = useRef<boolean | null>(null);
  if (reveal.current === null) reveal.current = peekReveal();
  useEffect(() => clearReveal(), []);
  return (
    <SelectScreen
      best={best}
      reveal={reveal.current}
      onPick={(i) =>
        navigate({ to: "/level/$plate", params: { plate: String(i + 1) } })
      }
    />
  );
}
