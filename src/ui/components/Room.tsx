// The workshop every screen sits in: the warm caisson glow vignetting back
// into the bakelite room, its slow living lamp (LightField), the film grain
// over everything, and the sheet's four registration crosses tucked into the
// corners. The title, the edition and the board all render this one backdrop,
// so the three screens read as the same lit table rather than three themes.
//
// Held `fixed` so it stays put behind screens that scroll (the edition), while
// still framing the ones that don't (title, board). Purely atmospheric and
// pointer-transparent — interactive layers sit above it in each screen.

import type { MotionValue } from "motion/react";
import { LightField } from "./LightField.tsx";
import { RegCross } from "./RegCross.tsx";

// the shared base wash — the board's original tuning, now the baseline the
// edition adopts unchanged so the two read identically. The title passes its
// own (its lamp biases left, seating the wordmark).
const ROOM_GRADIENT =
  "radial-gradient(ellipse 68% 60% at 50% 46%, var(--color-box-glow), #1a1611 46%, var(--color-room) 80%)";

const CORNERS = ["left-10", "right-10"] as const;
const CORNERS_WIDE = ["left-11", "right-11"] as const;

export function Room({
  variant = 0,
  reduced,
  gradient = ROOM_GRADIENT,
  crossSpread,
  wideCorners = false,
  grainOpacity,
}: {
  /** LightField treatment: 0 plain warm lamp (board & edition) · 1 halftone-in-
   *  glow · 2 title's cool counter-lamp. */
  variant?: number;
  reduced: boolean;
  /** Override the base wash for a screen with a biased composition. */
  gradient?: string;
  /** Title screen: the corner marks breathe into register with the wordmark. */
  crossSpread?: MotionValue<number>;
  /** Title screen tucks the marks a touch further in. */
  wideCorners?: boolean;
  /** Override the .grain default (0.04); the title sits it a touch lighter. */
  grainOpacity?: number;
}) {
  const [left, right] = wideCorners ? CORNERS_WIDE : CORNERS;
  const yTop = wideCorners ? "top-11" : "top-10";
  const yBottom = wideCorners ? "bottom-11" : "bottom-10";
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0" style={{ background: gradient }} />
      <LightField variant={variant} reduced={reduced} />
      <div
        className="grain absolute inset-0"
        style={grainOpacity == null ? undefined : { opacity: grainOpacity }}
      />
      <RegCross pos={`${yTop} ${left}`} spread={crossSpread} />
      <RegCross pos={`${yTop} ${right}`} spread={crossSpread} />
      <RegCross pos={`${yBottom} ${left}`} spread={crossSpread} />
      <RegCross pos={`${yBottom} ${right}`} spread={crossSpread} />
    </div>
  );
}
