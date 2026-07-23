import { iosVibrate } from "./ios-haptics.ts";

// One entry point for every buzz in the game. Android and friends get the real
// Web Vibration API; iPhones — where navigator.vibrate has never existed — fall
// back to the switch-toggle trick (see ios-haptics.ts). Anywhere neither works,
// it's a silent no-op.
export const vibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
      return;
    }
    iosVibrate(pattern);
  } catch {
    /* unavailable */
  }
};
