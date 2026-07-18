// Touch swipe → game direction (24 px threshold, dominant axis).

import { useRef } from "react";
import type { Pos } from "../../engine/types.ts";

export function useSwipe(onDir: (d: Pos) => void) {
  const start = useRef<[number, number] | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = [t.clientX, t.clientY];
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current[0];
    const dy = t.clientY - start.current[1];
    start.current = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    // a recognized swipe must not also fire the browser's synthesized click —
    // on tap-to-continue surfaces that would spend the gesture twice
    e.preventDefault();
    onDir(
      Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0],
    );
  };

  return { onTouchStart, onTouchEnd };
}
