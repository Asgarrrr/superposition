// Game keyboard: arrows (Shift = alternate gesture), z/u undo,
// r HELD to reset, s/x arm, Esc to levels, Enter next level.

import { useEffect, useRef } from "react";
import type { Pos } from "../../engine/types.ts";

const DIRS: Record<string, Pos> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

// Case-insensitive because reset is the one key we read on release too: `key` is
// resolved against the modifiers held at that instant, so grabbing Shift mid-hold
// turns the release into "R", the abandon is missed, and the sweep confirms anyway.
const isReset = (e: KeyboardEvent) => e.key.toLowerCase() === "r";

export interface KeyHandlers {
  play: (dir: Pos, wantAlt: boolean) => void;
  undo: () => void;
  resetDown: () => void;
  resetUp: () => void;
  toggleAlt: () => void;
  exit: () => void;
  next: () => void; // no-op if the level is not solved
}

export function useKeyboard(handlers: KeyHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const dir = DIRS[e.key];
      if (dir) {
        e.preventDefault();
        h.play(dir, e.shiftKey);
      } else if (e.key === "z" || e.key === "u") h.undo();
      // skipping `repeat` is what makes one press buy exactly one reset: the OS
      // floods keydown while R stays down, and each one would open a fresh sweep
      else if (isReset(e)) {
        if (!e.repeat) h.resetDown();
      } else if (e.key === "s" || e.key === "x") h.toggleAlt();
      else if (e.key === "Escape") h.exit();
      else if (e.key === "Enter") h.next();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isReset(e)) ref.current.resetUp();
    };
    // leaving the window mid-hold sends the keyup to whoever has focus now, so it
    // never reaches us — without this the run dies in a tab nobody is watching
    const onBlur = () => ref.current.resetUp();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}
