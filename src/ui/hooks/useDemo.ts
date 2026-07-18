// Playing a first-encounter demo, and remembering which ones were seen.
// The player drives a Demo's pre-computed steps on a timer and exposes the
// current frame as a plain game state plus the bump/bloom pulses Board already
// consumes — so a demo renders through the real Board in `ghost` mode and can't
// look different from live play. All the rules come from the engine (demoSteps).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, Level } from "../../engine/types.ts";
import { type Demo, demoSteps } from "../demos.ts";
import { reducedMotion } from "../motion.ts";
import type { Pulse } from "./useGame.ts";

const SEEN_KEY = "superposition.demos-seen";

// pacing (ms): a beat to let the board settle, one per played step, a last hold
const INTRO = 650;
const PACE = 950;
const HOLD = 1100;

/** Ids of demos already auto-played, persisted so they don't replay by default. */
export function useSeenDemos() {
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      // private browsing with storage disabled: degrade to in-memory only
    }
  }, [seen]);

  const markSeen = useCallback(
    (id: string) => setSeen((s) => (s.includes(id) ? s : [...s, id])),
    [],
  );
  return { seen, markSeen };
}

interface DemoView {
  active: boolean;
  level: Level | null;
  st: GameState | null;
  bump: Pulse | null;
  bloom: Pulse | null;
  skip: () => void;
}

/** Play `demo` (null = idle), calling `onDone` when it ends or is skipped. */
export function useDemoPlayer(demo: Demo | null, onDone: () => void): DemoView {
  const steps = useMemo(() => (demo ? demoSteps(demo).steps : []), [demo]);
  const [idx, setIdx] = useState(-1); // -1 = the start frame, before any step
  const [pulse, setPulse] = useState<{
    bump: Pulse | null;
    bloom: Pulse | null;
  }>({
    bump: null,
    bloom: null,
  });
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!demo) return;
    // reduced motion: no animated demo — hand straight back to real play
    if (reducedMotion) {
      done.current();
      return;
    }
    setIdx(-1);
    setPulse({ bump: null, bloom: null });
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = -1;
    const advance = () => {
      i += 1;
      if (i >= steps.length) {
        timers.push(setTimeout(() => done.current(), HOLD));
        return;
      }
      const s = steps[i];
      setIdx(i);
      if (s.blocked) {
        setPulse({
          bump: { payload: s.input.dir, t: Date.now() },
          bloom: null,
        });
      } else if (s.merged && s.state.merged) {
        setPulse({ bump: null, bloom: { payload: s.state.m, t: Date.now() } });
      } else {
        setPulse({ bump: null, bloom: null });
      }
      timers.push(setTimeout(advance, PACE));
    };
    timers.push(setTimeout(advance, INTRO));
    return () => timers.forEach(clearTimeout);
  }, [demo, steps]);

  const skip = useCallback(() => done.current(), []);
  const st = demo ? (idx < 0 ? demo.start : steps[idx].state) : null;

  return {
    active: !!demo,
    level: demo?.level ?? null,
    st,
    bump: pulse.bump,
    bloom: pulse.bloom,
    skip,
  };
}
