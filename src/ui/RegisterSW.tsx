// Registers the service worker (scripts/gen-sw.ts → /sw.js) once, on the
// client. Renders nothing; mounted in the root shell. The SW auto-updates
// silently (new build → new cache name → old cache dropped on activate), so
// there is no update prompt — it's a game, not critical data.

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
