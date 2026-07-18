// The first-encounter tutorial: on the ideal sandbox board, the player performs
// the mechanic's signature gesture themselves, on rails — only the scripted
// gesture advances, guided by a lit-up control and an on-board caption. State,
// feedback (bump/bloom) and sound mirror real play so it renders through the
// real Board; the scripted steps come from the engine (demoSteps).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, Level, Pos } from "../../engine/types.ts";
import { type Demo, demoSteps } from "../demos.ts";
import { vibrate } from "../haptics.ts";
import type { SoundFx } from "./useSound.ts";
import type { Pulse } from "./useGame.ts";

const SEEN_KEY = "superposition.demos-seen";
const HOLD = 1200; // let the last gesture's payoff settle before handing over

const eqDir = (a: Pos, b: Pos) => a[0] === b[0] && a[1] === b[1];

/** Ids of demos already played, persisted so they don't replay by default. */
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

/** Which control to light up next. `arm`: the ✕/world control must be pressed
 *  first; `dir`: the arrow to press (after arming, or for a plain move). */
export interface DemoGuidance {
  arm: boolean;
  dir: Pos | null;
}

interface GuidedDemo {
  active: boolean;
  level: Level | null;
  st: GameState | null;
  armed: boolean;
  bump: Pulse | null;
  bloom: Pulse | null;
  guidance: DemoGuidance;
  press: (dir: Pos, alt?: boolean) => void;
  arm: () => void;
  skip: () => void;
}

/** Play `demo` (null = idle) as an on-rails tutorial, calling `onDone` when the
 *  last gesture is performed or the player skips. */
export function useGuidedDemo(
  demo: Demo | null,
  fx: SoundFx,
  onDone: () => void,
): GuidedDemo {
  const steps = useMemo(() => (demo ? demoSteps(demo).steps : []), [demo]);
  const [idx, setIdx] = useState(0);
  const [st, setSt] = useState<GameState | null>(demo?.start ?? null);
  const [armed, setArmed] = useState(false);
  const [bump, setBump] = useState<Pulse | null>(null);
  const [bloom, setBloom] = useState<Pulse | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const finish = useRef<ReturnType<typeof setTimeout>>(undefined);

  // reset whenever the demo changes (new level, replay, or cleared)
  useEffect(() => {
    clearTimeout(finish.current);
    setIdx(0);
    setSt(demo?.start ?? null);
    setArmed(false);
    setBump(null);
    setBloom(null);
    return () => clearTimeout(finish.current);
  }, [demo]);

  const step = demo && idx < steps.length ? steps[idx] : null;
  const expected = step?.input ?? null;
  const needsArm = expected?.kind === "split" || expected?.kind === "shift";

  const guidance: DemoGuidance = !expected
    ? { arm: false, dir: null }
    : needsArm && !armed
      ? { arm: true, dir: null }
      : { arm: false, dir: expected.dir };

  const accept = useCallback(() => {
    const s = steps[idx];
    if (!s || !demo) return;
    setSt(s.state);
    setArmed(false);
    // feedback + sound, mirroring useGame's vocabulary
    if (s.blocked) {
      setBump({ payload: s.input.dir, t: Date.now() });
      setBloom(null);
      fx.block();
      vibrate(25);
    } else {
      setBump(null);
      if (s.merged && s.state.merged) {
        setBloom({ payload: s.state.m, t: Date.now() });
        fx.merge();
        vibrate([10, 20, 40]);
      } else {
        setBloom(null);
        if (s.input.kind === "split") {
          fx.split();
          vibrate([15, 30, 15]);
        } else if (s.input.kind === "shift") {
          fx.shift();
          vibrate(40);
        } else if (demo.level.mods.includes("glace")) {
          fx.slide();
        } else {
          fx.move();
        }
      }
    }
    const next = idx + 1;
    setIdx(next);
    if (next >= steps.length) {
      finish.current = setTimeout(() => done.current(), HOLD);
    }
  }, [demo, fx, idx, steps]);

  // `alt` (Shift+arrow, or a swipe while armed) arms and plays in one gesture,
  // so the secondary action works from the keyboard, not only the ✕ button.
  const press = useCallback(
    (dir: Pos, alt = false) => {
      if (!expected || (needsArm && !armed && !alt)) return;
      if (eqDir(expected.dir, dir)) accept();
    },
    [accept, armed, expected, needsArm],
  );

  const arm = useCallback(() => {
    if (needsArm && !armed) setArmed(true);
  }, [armed, needsArm]);

  const skip = useCallback(() => done.current(), []);

  return {
    active: !!demo,
    level: demo?.level ?? null,
    st,
    armed,
    bump,
    bloom,
    guidance,
    press,
    arm,
    skip,
  };
}
