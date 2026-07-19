// Touch swipe → game direction (24 px threshold, dominant axis).
//
// Maintien-slide: holding the finger still for a beat before sliding arms the
// alternate gesture — the tactile equivalent of holding Maj before an arrow on
// desktop. `onHold(true)` fires once the dwell completes (so the caller can show
// the armed preview + buzz); the resulting swipe is reported as `alt`. Moving
// before the dwell completes is a plain swipe; `onHold(false)` always clears the
// armed state on release.
//
// While armed, `onAim` streams the direction the finger has committed to — once
// it passes the same distance that would fire the swipe — so the split preview
// narrows from every legal direction down to the one about to fire (cyan toward
// the slide, magenta mirrored). Null below that distance (no committed direction
// yet) and on release. Emitted only when the direction changes, so a steady
// slide doesn't re-render every frame.

import { useRef } from "react";
import type { Pos } from "../../engine/types.ts";

const SWIPE = 24; // px of travel before a drag counts as a swipe (and commits an aim)
const MOVE_TOL = 10; // px of drift tolerated during the dwell before it's a slide
const HOLD_MS = 220; // dwell that arms the alternate gesture

export function useSwipe(
  onDir: (d: Pos, alt: boolean) => void,
  opts: { onHold?: (held: boolean) => void; onAim?: (dir: Pos | null) => void } = {},
) {
  const { onHold, onAim } = opts;
  const start = useRef<[number, number] | null>(null);
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const aimKey = useRef(""); // last direction handed to onAim, to skip no-op repeats

  const dominant = (dx: number, dy: number): Pos =>
    Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];

  // stream the aimed direction, but only when it actually changes — a held slide
  // fires touchmove every frame and would otherwise re-render on each one
  const emitAim = (dir: Pos | null) => {
    const key = dir ? `${dir[0]},${dir[1]}` : "";
    if (key === aimKey.current) return;
    aimKey.current = key;
    onAim?.(dir);
  };

  const disarm = () => {
    clearTimeout(timer.current);
    if (held.current) {
      held.current = false;
      onHold?.(false);
    }
    emitAim(null);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = [t.clientX, t.clientY];
    held.current = false;
    aimKey.current = "";
    if (onHold) {
      timer.current = setTimeout(() => {
        held.current = true;
        onHold(true);
      }, HOLD_MS);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current[0];
    const dy = t.clientY - start.current[1];
    if (!held.current) {
      // early drift means the finger is swiping, not dwelling — cancel the arm
      if (Math.abs(dx) > MOVE_TOL || Math.abs(dy) > MOVE_TOL)
        clearTimeout(timer.current);
      return;
    }
    // armed: the preview commits to a direction at the SAME distance that would
    // fire the swipe, so it never promises a split a short release won't deliver
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) emitAim(null);
    else emitAim(dominant(dx, dy));
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    clearTimeout(timer.current);
    if (!start.current) {
      disarm();
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current[0];
    const dy = t.clientY - start.current[1];
    const alt = held.current;
    start.current = null;
    held.current = false;
    emitAim(null);
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) {
      // held then released without a slide → just disarm, and let the tap
      // through (no preventDefault) so tap-to-continue surfaces still fire
      if (alt) onHold?.(false);
      return;
    }
    // a recognized swipe must not also fire the browser's synthesized click —
    // on tap-to-continue surfaces that would spend the gesture twice
    e.preventDefault();
    onDir(dominant(dx, dy), alt);
    if (alt) onHold?.(false);
  };

  const onTouchCancel = () => {
    start.current = null;
    disarm();
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
