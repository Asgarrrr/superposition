// The board's develop-in. Once, on level mount, the sheet gets printed layer by
// layer: the grid is ruled first, then the registration marks, the walls, the
// light squares, the goals, and finally the two pawns drop in. Each internal
// layer is a motion group that settles from a hair below with a short delay, so
// the print assembles rather than appearing whole. Plays only on mount (the
// board no longer remounts on a blocked move), and composes over the panel's
// own entrance without touching any of the live gameplay bindings.

import type { Variants } from "motion/react";
import { PRINT_EASE, reducedMotion } from "../motion.ts";

// the entry state for every board layer (shared by Board and InkLayer); `false`
// skips the develop-in under reduced motion
export const introInitial = reducedMotion ? false : "hidden";

/** A layer's entrance: fade + a small settle from below, after `delay` s. */
const layer = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: PRINT_EASE, delay },
  },
});

// The layers print in order (delays in seconds from board mount): grid ruled
// first, then the registration marks, walls, light squares, goals, and the two
// pawns last. Precomputed once — a board re-renders every move, so the variant
// objects must be stable references or the entrance could re-trigger mid-play.
export const introVariants = {
  grid: layer(0.22),
  marks: layer(0.26),
  walls: layer(0.32),
  light: layer(0.36),
  goal: layer(0.42),
  pawn: layer(0.5),
} as const;
