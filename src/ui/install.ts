// Install-banner eligibility — the pure decision plus the browser probes it
// reads. The decision (`installMode`) is a plain function of four booleans so it
// can be unit-tested without a DOM; the probes below are the impure edges that
// feed it (matchMedia, navigator, localStorage), each guarded for the no-window
// case so importing this module never throws server-side.

const DISMISS_KEY = "superposition.install-dismissed";

/** Which banner to show, or none. Android gets the real prompt; iOS Safari gets
 *  the pedagogical share-sheet hint; everything else (or once dismissed / once
 *  installed) shows nothing. */
export type InstallMode = "android" | "ios";

export interface InstallEnv {
  /** the player closed the banner before — permanent, no cooldown */
  dismissed: boolean;
  /** already launched from the home screen — nothing to install */
  standalone: boolean;
  /** a `beforeinstallprompt` event was captured (installable Chrome) */
  hasPrompt: boolean;
  /** iOS Safari, where no programmatic prompt exists */
  isIosSafari: boolean;
  /** touch-first device — desktop Chrome also fires `beforeinstallprompt`,
   *  but the banner is a phone invitation only */
  mobile: boolean;
}

export function installMode(env: InstallEnv): InstallMode | null {
  if (env.dismissed || env.standalone) return null;
  if (env.hasPrompt && env.mobile) return "android";
  if (env.isIosSafari) return "ios";
  return null;
}

/** Running as an installed PWA — `display-mode: standalone` (Android/desktop) or
 *  the legacy `navigator.standalone` flag (iOS). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return "standalone" in navigator && Boolean(navigator.standalone);
}

/** iOS Safari specifically — iOS in-app browsers (Chrome/Firefox/Edge use
 *  CriOS/FxiOS/EdgiOS) can't drive the share-sheet install, so they're excluded.
 *  Covers iPadOS 13+, which reports as desktop Safari but exposes touch points. */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && safari;
}

/** Touch-first device, the only audience for the banner. */
export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // private browsing with storage disabled: the banner simply reappears
  }
}
