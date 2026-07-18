// The first-encounter tutorial: on the ideal sandbox board, the player performs
// the mechanic's signature gesture themselves, on rails — a title card names
// the mechanic, each beat draws its gesture as marching arrows on the board,
// the gesture fires with the real feedback (bump/bloom/sound), and its payoff
// line waits for the player to continue: nothing is on a timer, the player
// sets the pace. Free beats accept ANY direction and let the engine arbitrate
// (an illegal choice bumps and invites another try). All state changes go
// through applyInput — the tutorial cannot show a rule the engine wouldn't
// apply.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, Level, Pos } from "../../engine/types.ts";
import { applyInput, successors } from "../../engine/successors.ts";
import { add, eq, sub } from "../../engine/grid.ts";
import { m } from "../../paraglide/messages.js";
import { isAltKind } from "../altGesture.ts";
import { type Demo, type DemoBeat } from "../demos.ts";
import { vibrate } from "../haptics.ts";
import { inputSignature } from "../signatures.ts";
import type { SoundFx } from "./useSound.ts";
import type { Pulse } from "./useGame.ts";

const SEEN_KEY = "superposition.demos-seen";
const HINT_MS = 1600; // a try-again hint clears itself: the retry needs no click
const HOLD = 1200; // "à toi de jouer", while the tape frame fades

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

/** A marching arrow drawn on the board: the gesture, shown where it will act.
 *  `tone` picks the ink — cyan, magenta, or the white merged pawn. */
export interface DemoGuide {
  from: Pos;
  to: Pos;
  tone: "a" | "b" | "w";
}

interface GuidedDemo {
  active: boolean;
  phase: DemoPhase;
  waiting: boolean; // a payoff is on screen; the player continues at their pace
  level: Level | null;
  st: GameState | null;
  armed: boolean;
  bump: Pulse | null;
  bloom: Pulse | null;
  nudge: Pulse | null; // a wrong input: shake the caption, retrigger the pulse
  caption: DemoCaption | null;
  ghosts: { a: Pos[]; b: Pos[] } | null; // landing preview for a fixed push
  guides: DemoGuide[]; // marching arrows for the current gesture
  guidance: DemoGuidance;
  press: (dir: Pos, alt?: boolean) => void;
  arm: () => void;
  next: () => void; // continue past the title card or a payoff
  skip: () => void;
}

const NO_GUIDE: DemoGuidance = { arm: false, dir: null, any: false };

/** The board cells the two inks occupy (the merged pawn counts for both). */
const cells = (st: GameState): { a: Pos; b: Pos } =>
  st.merged ? { a: st.m, b: sub(st.m, st.off) } : { a: st.a, b: st.b };

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
  const done = useRef(onDone);
  done.current = onDone;
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stampTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // a payoff on screen is what gates the tutorial: derived, so no path can
  // desync the pause from the caption that explains it
  const waiting = payoff?.kind === "done";

  // reset whenever the demo changes (new level, replay, or cleared)
  useEffect(() => {
    clearTimeout(holdTimer.current);
    clearTimeout(hintTimer.current);
    clearTimeout(stampTimer.current);
    setIdx(0);
    setSt(demo?.start ?? null);
    setPhase("title");
    setArmed(false);
    setBump(null);
    setBloom(null);
    setNudge(null);
    setPayoff(null);
    // the title card's stamp slams at ~55% of its 700ms animation (250ms delay)
    if (demo) stampTimer.current = setTimeout(() => fx.stamp(), 600);
    return () => {
      clearTimeout(holdTimer.current);
      clearTimeout(hintTimer.current);
      clearTimeout(stampTimer.current);
    };
  }, [demo, fx]);

  const beat: DemoBeat | null =
    demo && phase === "play" && !waiting && idx < demo.beats.length
      ? demo.beats[idx]
      : null;
  const needsArm = beat ? isAltKind(beat.input.kind) : false;
  // the direction the script expects: null on free beats (any works)
  const wantDir: Pos | null = !beat ? null : beat.free ? null : beat.input.dir;

  const guidance: DemoGuidance = !beat
    ? NO_GUIDE
    : needsArm && !armed
      ? { arm: true, dir: null, any: false }
      : { arm: false, dir: wantDir, any: wantDir === null };

  // ── on-board hints, read straight off the engine so they can't drift ──
  // Ghost rings mark landings; marching arrows draw the gesture itself.
  // Armed gestures reveal their arrows once armed (the ✕/⇄ pulse leads).
  // Two coordinate frames: `ghosts` render inside InkLayer B, which the world
  // offset already translates, so they stay in B-film coordinates; `guides`
  // render in the unshifted board overlay, so every magenta position gets
  // `+ off` (that sum IS the cell the player sees the ink on).
  let ghosts: { a: Pos[]; b: Pos[] } | null = null;
  const guides: DemoGuide[] = [];
  if (beat && st && demo) {
    const cur = cells(st);
    const curB = add(cur.b, st.off); // magenta's board cell
    if (beat.input.kind === "move" && wantDir) {
      const next = applyInput(st, demo.level, { kind: "move", dir: wantDir });
      if (next) {
        const to = cells(next);
        ghosts = {
          a: eq(to.a, cur.a) ? [] : [to.a],
          b: eq(to.b, cur.b) ? [] : [to.b],
        };
        if (st.merged) {
          if (!eq(to.a, cur.a))
            guides.push({ from: cur.a, to: to.a, tone: "w" });
        } else {
          if (!eq(to.a, cur.a))
            guides.push({ from: cur.a, to: to.a, tone: "a" });
          if (!eq(to.b, cur.b))
            guides.push({ from: curB, to: add(to.b, st.off), tone: "b" });
        }
      } else if (st.merged) {
        // the scripted blocked lesson: draw the attempted push anyway
        guides.push({ from: cur.a, to: add(cur.a, wantDir), tone: "w" });
      } else {
        // both inks are pinned — draw both attempts, so the caption's subject
        // (the walled-in ink) gets its arrow too
        guides.push({ from: cur.a, to: add(cur.a, wantDir), tone: "a" });
        guides.push({ from: curB, to: add(curB, wantDir), tone: "b" });
      }
    } else if (beat.input.kind === "split" && armed) {
      // one diverging arrow pair per legal split — cyan follows, magenta mirrors
      for (const [inp, next] of successors(st, demo.level)) {
        if (inp.kind !== "split" || next.merged) continue;
        if (wantDir && !eq(inp.dir, wantDir)) continue;
        guides.push({ from: cur.a, to: next.a, tone: "a" });
        guides.push({ from: curB, to: add(next.b, st.off), tone: "b" });
      }
    } else if (beat.input.kind === "shift" && armed && wantDir) {
      // the film slides under the pawns: the magenta ink will appear here
      guides.push({ from: curB, to: add(curB, wantDir), tone: "b" });
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
      const sig = inputSignature(st, next, beat.input.kind, demo.level);
      fx[sig.fx]();
      if (sig.vibrate !== null) vibrate(sig.vibrate);
      if (next === null) {
        setBump({ payload: dir, t: Date.now() });
        setBloom(null);
        if (beat.free) {
          // free beat: the refusal is itself a lesson — invite another try,
          // and stay armed so the next arrow goes through as told. The hint
          // clears on its own: a retry should not need a click.
          clearTimeout(hintTimer.current);
          setPayoff({ text: m.demo_try_other(), kind: "hint" });
          hintTimer.current = setTimeout(() => {
            setPayoff(null);
            setNudge(null);
          }, HINT_MS);
          return;
        }
        // the scripted blocked lesson (white on light): feedback + advance
        setArmed(false);
      } else {
        setArmed(false);
        setBump(null);
        if (!st.merged && next.merged)
          setBloom({ payload: next.m, t: Date.now() });
        else setBloom(null);
        setSt(next);
      }
      // the payoff stays until the player continues — no timer sets the pace
      clearTimeout(hintTimer.current);
      setPayoff({ text: beat.done(), kind: "done" });
      setIdx(idx + 1);
    },
    [beat, demo, fx, idx, st],
  );

  /** Continue: past the title card, past a payoff, or out of the handoff. */
  const next = useCallback(() => {
    if (!demo) return;
    if (phase === "title") {
      // dismissing the card also cancels its pending stamp sound
      clearTimeout(stampTimer.current);
      return setPhase("play");
    }
    if (phase === "handoff") {
      // an eager hand cuts it short — and must not let the timer fire a second
      // done on a consumer less idempotent than PlayScreen's
      clearTimeout(holdTimer.current);
      return done.current();
    }
    if (!waiting) return;
    setPayoff(null);
    setNudge(null);
    if (idx >= demo.beats.length) {
      // the hand returns: the tape frame fades, then the real level develops in
      setPhase("handoff");
      clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => done.current(), HOLD);
    }
  }, [demo, idx, phase, waiting]);

  // `alt` (Shift+arrow, or a swipe while armed) arms and plays in one gesture,
  // so the secondary action works from the keyboard, not only the ✕ button.
  const press = useCallback(
    (dir: Pos, alt = false) => {
      if (!demo) return;
      if (phase !== "play" || waiting) return next(); // any gesture continues
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
    [accept, armed, beat, demo, next, phase, reject, waiting, wantDir],
  );

  const arm = useCallback(() => {
    if (!demo) return;
    if (phase !== "play" || waiting) {
      next();
      // tapping ⇄/✕ over a payoff continues AND arms when the upcoming beat
      // needs it — the control the guidance is about to spotlight must not
      // read as dead on its first press
      const upcoming = demo.beats[idx];
      if (
        phase === "play" &&
        waiting &&
        upcoming &&
        upcoming.input.kind !== "move"
      )
        setArmed(true);
      return;
    }
    if (!beat) return;
    // one-way while guiding: a double tap on the lit control must not silently
    // disarm and appear to regress the tutorial
    if (needsArm) setArmed(true);
    else reject(beat.input.dir); // ✕ pressed when a plain push is expected
  }, [beat, demo, idx, needsArm, next, phase, reject, waiting]);

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
    waiting,
    level: demo?.level ?? null,
    st,
    armed,
    bump,
    bloom,
    nudge,
    caption,
    ghosts,
    guides,
    guidance,
    press,
    arm,
    next,
    skip,
  };
}
