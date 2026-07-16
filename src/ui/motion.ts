// Shared motion primitives, so every screen and the board's internal layers
// read as one gesture and honour prefers-reduced-motion from a single source.
// Both are evaluated once at import — the screens already relied on a static,
// non-reactive probe, and keeping one copy means a change to how reduced motion
// is detected can't leave one surface out of step.

export const reducedMotion =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// the print settle — the develop-in easing shared by the title, the edition,
// the play composition and the board's layers
export const PRINT_EASE = [0.16, 1, 0.3, 1] as const;
