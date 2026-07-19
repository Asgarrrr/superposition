// Touch swipe → game direction (24 px threshold, dominant axis).
//
// Maintien-slide: holding the finger still for a beat before sliding arms the
// alternate gesture — the tactile equivalent of holding Maj before an arrow on
// desktop. `onHold(true)` fires once the dwell completes (so the caller can show
// the armed preview + buzz); the resulting swipe is reported as `alt`. Moving
// before the dwell completes is a plain swipe; `onHold(false)` always clears the
// armed state on release.

import { useRef } from "react";
import type { Pos } from "../../engine/types.ts";

const SWIPE = 24; // px of travel before a drag counts as a swipe
const MOVE_TOL = 10; // px of drift tolerated during the dwell before it's a slide
const HOLD_MS = 220; // dwell that arms the alternate gesture

export function useSwipe(
  onDir: (d: Pos, alt: boolean) => void,
  opts: { onHold?: (held: boolean) => void } = {},
) {
  const { onHold } = opts;
  const start = useRef<[number, number] | null>(null);
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const disarm = () => {
    clearTimeout(timer.current);
    if (held.current) {
      held.current = false;
      onHold?.(false);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = [t.clientX, t.clientY];
    held.current = false;
    if (onHold) {
      timer.current = setTimeout(() => {
        held.current = true;
        onHold(true);
      }, HOLD_MS);
    }
  };

  // early drift means the finger is swiping, not dwelling — cancel the arm.
  // Once armed, the finger is free to slide out into the gesture.
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current || held.current) return;
    const t = e.touches[0];
    if (
      Math.abs(t.clientX - start.current[0]) > MOVE_TOL ||
      Math.abs(t.clientY - start.current[1]) > MOVE_TOL
    ) {
      clearTimeout(timer.current);
    }
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
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) {
      // held then released without a slide → just disarm, and let the tap
      // through (no preventDefault) so tap-to-continue surfaces still fire
      if (alt) onHold?.(false);
      return;
    }
    // a recognized swipe must not also fire the browser's synthesized click —
    // on tap-to-continue surfaces that would spend the gesture twice
    e.preventDefault();
    onDir(
      Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0],
      alt,
    );
    if (alt) onHold?.(false);
  };

  const onTouchCancel = () => {
    start.current = null;
    disarm();
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
