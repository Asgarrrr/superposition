// The first-encounter tutorial: on the ideal sandbox board, the player performs
// the mechanic's signature gesture themselves, on rails — a title card names
// the mechanic, each beat shows its instruction, the gesture fires with the
// real feedback (bump/bloom/sound), a payoff line names what just happened,
// and a handoff beat returns the hand. Free beats accept ANY direction and let
// the engine arbitrate (an illegal choice bumps and invites another try), so
// the player verifies the rule in the direction THEY picked. All state changes
// go through applyInput — the tutorial cannot show a rule the engine wouldn't
// apply.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, Level, Pos } from "../../engine/types.ts";
import { applyInput } from "../../engine/successors.ts";
import { eq, sub } from "../../engine/grid.ts";
import { m } from "../../paraglide/messages.js";
import { type Demo, type DemoBeat } from "../demos.ts";
import { vibrate } from "../haptics.ts";
import type { SoundFx } from "./useSound.ts";
import type { Pulse } from "./useGame.ts";

const SEEN_KEY = "superposition.demos-seen";
const TITLE_MS = 1700; // the mechanic's name card, before the first instruction
const PAYOFF_MS = 1200; // the "what just happened" line after a gesture
const HOLD = 1400; // "à toi de jouer", while the tape frame fades

const neg = (d: Pos): Pos => [-d[0], -d[1]];

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
 *  first; `dir`: the arrow to press; `any`: every arrow works — pick one. */
export interface DemoGuidance {
  arm: boolean;
  dir: Pos | null;
  any: boolean;
}

export type DemoPhase = "title" | "play" | "handoff";

/** The caption under the tape frame: an instruction (`say`), a payoff naming
 *  what just fired (`done`), a try-again hint (`hint`), or the handoff. */
export interface DemoCaption {
  text: string;
  kind: "say" | "done" | "hint" | "hand";
}

interface GuidedDemo {
  active: boolean;
  phase: DemoPhase;
  level: Level | null;
  st: GameState | null;
  armed: boolean;
  bump: Pulse | null;
  bloom: Pulse | null;
  nudge: Pulse | null; // a wrong input: shake the caption, retrigger the pulse
  caption: DemoCaption | null;
  ghosts: { a: Pos[]; b: Pos[] } | null; // landing preview for a fixed push
  guidance: DemoGuidance;
  press: (dir: Pos, alt?: boolean) => void;
  arm: () => void;
  skip: () => void;
}

const NO_GUIDE: DemoGuidance = { arm: false, dir: null, any: false };

/** Play `demo` (null = idle) as an on-rails tutorial, calling `onDone` when the
 *  last gesture is performed or the player skips. */
export function useGuidedDemo(
  demo: Demo | null,
  fx: SoundFx,
  onDone: () => void,
): GuidedDemo {
  const [idx, setIdx] = useState(0);
  const [st, setSt] = useState<GameState | null>(demo?.start ?? null);
  const [phase, setPhase] = useState<DemoPhase>("title");
  const [armed, setArmed] = useState(false);
  const [bump, setBump] = useState<Pulse | null>(null);
  const [bloom, setBloom] = useState<Pulse | null>(null);
  const [nudge, setNudge] = useState<Pulse | null>(null);
  const [payoff, setPayoff] = useState<DemoCaption | null>(null);
  const lastShift = useRef<Pos | null>(null); // the free shift the player chose
  const done = useRef(onDone);
  done.current = onDone;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  // one payoff-clear timer at a time: a quick next gesture must not have the
  // previous beat's timer wipe its fresh payoff line
  const payoffTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showPayoff = (p: DemoCaption, thenClear = true) => {
    clearTimeout(payoffTimer.current);
    setPayoff(p);
    if (thenClear)
      payoffTimer.current = setTimeout(() => {
        setPayoff(null);
        setNudge(null); // the refusal shake must not outlive its caption
      }, PAYOFF_MS);
  };

  // reset whenever the demo changes (new level, replay, or cleared)
  useEffect(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    clearTimeout(payoffTimer.current);
    setIdx(0);
    setSt(demo?.start ?? null);
    setPhase("title");
    setArmed(false);
    setBump(null);
    setBloom(null);
    setNudge(null);
    setPayoff(null);
    lastShift.current = null;
    if (demo)
      timers.current.push(
        setTimeout(
          () => setPhase((p) => (p === "title" ? "play" : p)),
          TITLE_MS,
        ),
      );
    return () => {
      for (const t of timers.current) clearTimeout(t);
      clearTimeout(payoffTimer.current);
    };
  }, [demo]);

  const beat: DemoBeat | null =
    demo && phase === "play" && idx < demo.beats.length
      ? demo.beats[idx]
      : null;
  const needsArm = beat
    ? beat.input.kind === "split" || beat.input.kind === "shift"
    : false;
  // the direction the script expects: null on free beats (any), the reverse of
  // the player's own gesture on realign beats
  const wantDir: Pos | null = !beat
    ? null
    : beat.free
      ? null
      : beat.realign && lastShift.current
        ? neg(lastShift.current)
        : beat.input.dir;

  const guidance: DemoGuidance = !beat
    ? NO_GUIDE
    : needsArm && !armed
      ? { arm: true, dir: null, any: false }
      : { arm: false, dir: wantDir, any: wantDir === null };

  // landing preview for a fixed push: where the engine will put each ink, read
  // straight off applyInput so it can't drift from the rule. (Split beats get
  // the armed split preview; free beats have nothing to pin down.)
  let ghosts: { a: Pos[]; b: Pos[] } | null = null;
  if (beat && st && demo && beat.input.kind === "move" && wantDir) {
    const next = applyInput(st, demo.level, { kind: "move", dir: wantDir });
    if (next) {
      const [na, nb] = next.merged
        ? [next.m, sub(next.m, next.off)]
        : [next.a, next.b];
      const [ca, cb] = st.merged ? [st.m, sub(st.m, st.off)] : [st.a, st.b];
      ghosts = {
        a: eq(na, ca) ? [] : [na],
        b: eq(nb, cb) ? [] : [nb],
      };
    }
  }

  // a wrong input: never silent — shake the caption, retrigger the guide pulse
  const reject = useCallback(
    (dir: Pos) => {
      setNudge({ payload: dir, t: Date.now() });
      fx.tick();
      vibrate(10);
    },
    [fx],
  );

  const accept = useCallback(
    (dir: Pos) => {
      if (!beat || !demo || !st) return;
      const next = applyInput(st, demo.level, { kind: beat.input.kind, dir });
      setNudge(null);
      if (next === null) {
        setBump({ payload: dir, t: Date.now() });
        setBloom(null);
        fx.block();
        vibrate(25);
        if (beat.free) {
          // free beat: the refusal is itself a lesson — invite another try,
          // and stay armed so the next arrow goes through as told
          showPayoff({ text: m.demo_try_other(), kind: "hint" });
          return;
        }
        // the scripted blocked lesson (white on light): feedback + advance
        setArmed(false);
      } else {
        setArmed(false);
        setBump(null);
        if (beat.input.kind === "shift") lastShift.current = dir;
        if (!st.merged && next.merged) {
          setBloom({ payload: next.m, t: Date.now() });
          fx.merge();
          vibrate([10, 20, 40]);
        } else {
          setBloom(null);
          if (beat.input.kind === "split") {
            fx.split();
            vibrate([15, 30, 15]);
          } else if (beat.input.kind === "shift") {
            fx.shift();
            vibrate(40);
          } else if (demo.level.mods.includes("glace")) {
            fx.slide();
          } else {
            fx.move();
          }
        }
        setSt(next);
      }
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      if (nextIdx >= demo.beats.length) {
        // payoff settles, the hand returns (phase fallback shows the handoff
        // line), the tape frame fades, then the real level develops in
        showPayoff({ text: beat.done(), kind: "done" }, false);
        later(() => {
          setPayoff(null);
          setPhase("handoff");
        }, PAYOFF_MS);
        later(() => done.current(), PAYOFF_MS + HOLD);
      } else {
        showPayoff({ text: beat.done(), kind: "done" });
      }
    },
    [beat, demo, fx, idx, st],
  );

  // `alt` (Shift+arrow, or a swipe while armed) arms and plays in one gesture,
  // so the secondary action works from the keyboard, not only the ✕ button.
  const press = useCallback(
    (dir: Pos, alt = false) => {
      if (!demo) return;
      if (phase === "title") return setPhase("play"); // impatient: skip the card
      if (phase === "handoff") return done.current(); // an eager hand cuts the beat short
      if (!beat) return;
      if (beat.input.kind === "move") {
        // Shift+arrow is the split/world gesture — a plain push is expected
        if (alt || !eq(beat.input.dir, dir)) return reject(dir);
        return accept(dir);
      }
      if (!armed && !alt) return reject(dir);
      if (wantDir && !eq(wantDir, dir)) return reject(dir);
      accept(dir);
    },
    [accept, armed, beat, demo, phase, reject, wantDir],
  );

  const arm = useCallback(() => {
    if (phase === "title") return setPhase("play");
    if (phase === "handoff") return done.current();
    if (!beat) return;
    // one-way while guiding: a double tap on the lit control must not silently
    // disarm and appear to regress the tutorial
    if (needsArm) setArmed(true);
    else reject(beat.input.dir); // ✕ pressed when a plain push is expected
  }, [beat, needsArm, phase, reject]);

  const skip = useCallback(() => done.current(), []);

  const caption: DemoCaption | null =
    phase === "title"
      ? null
      : (payoff ??
        (beat
          ? { text: beat.say(), kind: "say" }
          : phase === "handoff"
            ? { text: m.demo_handoff(), kind: "hand" }
            : null));

  return {
    active: !!demo,
    phase,
    level: demo?.level ?? null,
    st,
    armed,
    bump,
    bloom,
    nudge,
    caption,
    ghosts,
    guidance,
    press,
    arm,
    skip,
  };
}
