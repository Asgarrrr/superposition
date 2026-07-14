// The light-table "opening": EnterScreen floods the screen white from the
// register point, then /levels reveals out of that same white so the route
// swap reads as one continuous gesture. Both screens share the exact tone and
// centre here, so the seam between the two routes is invisible.

export const EYE = { cx: 50, cy: 52 } as const;

export const floodGradient = `radial-gradient(circle at ${EYE.cx}% ${EYE.cy}%, #ffffff 0%, #f7f3ea 60%, #f2ede4 100%)`;

// One-shot hand-off: the enter screen arms this right before routing to
// /levels, the selector reads it once on mount and clears it after committing.
// Kept out of history state on purpose, so back/forward or a plain return to
// the selector never replay it — it fires only on the deliberate enter → levels
// hop. `peek` stays pure (no mutation during render) so a discarded concurrent
// render can't silently drain the flag; `clear` runs from the selector's
// mount effect.
let revealPending = false;

export const armReveal = () => {
  revealPending = true;
};

export const peekReveal = (): boolean => revealPending;

export const clearReveal = () => {
  revealPending = false;
};
