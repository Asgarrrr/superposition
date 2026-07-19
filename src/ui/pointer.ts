// Is this a touch device — no hover, coarse pointer? Drives input-specific copy:
// the on-screen hints name the Maj+arrow chord on a keyboard and the tactile
// maintien-slide on a phone. Read live (a device's input class doesn't change
// mid-session) and SSR-safe — the server has no `window`, so it falls back to
// the desktop phrasing, which the client then corrects on hydration.
export const coarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: none) and (pointer: coarse)").matches === true;
