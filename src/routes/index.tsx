import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EnterScreen } from "../ui/screens/EnterScreen.tsx";
import { InstallBanner } from "../ui/components/InstallBanner.tsx";
import { armReveal } from "../ui/transition.ts";

// Landing page — the "align to enter" title screen. Solving it opens the light
// and routes into the level select. Client-only (SSR disabled in src/start.ts).
export const Route = createFileRoute("/")({ component: IndexRoute });

function IndexRoute() {
  const navigate = useNavigate();
  // arm the reveal so /levels opens out of the same white flood — one-shot, so
  // a plain return to the selector never replays it
  return (
    <>
      <EnterScreen
        onStart={() => {
          armReveal();
          navigate({ to: "/levels" });
        }}
      />
      <InstallBanner />
    </>
  );
}
