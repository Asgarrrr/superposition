// Wiring for the install banner. `beforeinstallprompt` fires once, early, and
// only on the page that first became installable — capturing it in a module
// singleton (started at import) means the event survives the route swap from the
// title screen to the level select, where either banner may mount. The hook is a
// thin subscription over that singleton plus the dismissed/standalone/iOS probes.

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  installMode,
  isCoarsePointer,
  isDismissed,
  isIosSafari,
  isStandalone,
  markDismissed,
  type InstallMode,
} from "../install.ts";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const subs = new Set<() => void>();

const notify = () => subs.forEach((f) => f());

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    // keep the event so we can prompt on our own tap, in our own design
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  // installed out-of-band (browser menu): drop the captured prompt
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}
start();

const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};
const hasPromptSnapshot = () => deferred !== null;

export function useInstallPrompt(): {
  mode: InstallMode | null;
  install: () => void;
  dismiss: () => void;
} {
  const hasPrompt = useSyncExternalStore(
    subscribe,
    hasPromptSnapshot,
    () => false,
  );
  const [dismissed, setDismissed] = useState(isDismissed);
  // one-shot probes: standalone/iOS can't change within a session
  const standalone = useMemo(isStandalone, []);
  const iosSafari = useMemo(isIosSafari, []);
  const mobile = useMemo(isCoarsePointer, []);

  const mode = installMode({
    dismissed,
    standalone,
    hasPrompt,
    isIosSafari: iosSafari,
    mobile,
  });

  const dismiss = useCallback(() => {
    markDismissed();
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    // accepted → the app installs; retire the banner for good
    if (outcome === "accepted") {
      markDismissed();
      setDismissed(true);
    }
  }, []);

  return { mode, install: () => void install(), dismiss };
}
