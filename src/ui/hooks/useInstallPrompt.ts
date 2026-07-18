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

function onBeforeInstallPrompt(e: Event) {
  // keep the event so we can prompt on our own tap, in our own design
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  notify();
}
// installed out-of-band (browser menu): drop the captured prompt
function onAppInstalled() {
  deferred = null;
  notify();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
}
start();

// dev-only: HMR re-evaluates this module, re-running start() with a fresh
// `started`; without tearing the old listeners down they stack across edits.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
  });
}

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
    const evt = deferred;
    if (!evt) return;
    // Consume the event before awaiting: a second tap (or a double-tap) while
    // the OS prompt is open must not call prompt() twice on the same event —
    // that throws InvalidStateError. The prompt is single-use regardless of
    // outcome, so clearing it here is correct whether accepted or dismissed.
    deferred = null;
    notify();
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    // accepted → the app installs; retire the banner for good
    if (outcome === "accepted") {
      markDismissed();
      setDismissed(true);
    }
  }, []);

  return { mode, install: () => void install(), dismiss };
}
