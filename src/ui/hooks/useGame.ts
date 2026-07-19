// State of a play session and the sensory feedback of each gesture.
// All the rules come from the engine — here we only play
// inputs and translate the result into sound / haptics / visuals.

import { useEffect, useRef, useState } from "react";
import type {
  GameState,
  Input,
  Level,
  Pos,
  TraceStep,
} from "../../engine/types.ts";
import {
  hashState,
  initialState,
  isWin,
  MAX_SHIFT,
} from "../../engine/state.ts";
import { applyInput } from "../../engine/successors.ts";
import { solveFrom } from "../../solver/bfs.ts";
import { eq } from "../../engine/grid.ts";
import { m } from "../../paraglide/messages.js";
import { altGesture } from "../altGesture.ts";
import { vibrate } from "../haptics.ts";
import { inputSignature } from "../signatures.ts";
import type { Solve } from "../submissionPolicy.ts";
import type { SoundFx } from "./useSound.ts";

export interface Pulse {
  readonly payload: Pos;
  readonly t: number; // timestamp: re-triggers the animation on every move
}

interface IceTrails {
  a: { from: Pos } | null;
  b: { from: Pos } | null;
}

export function useGame(
  level: Level,
  fx: SoundFx,
  onWin?: (moves: number) => void,
  onHintedWin?: () => void,
) {
  const [st, setSt] = useState<GameState>(() => initialState(level));
  const [moves, setMoves] = useState(0);
  const [altArmed, setAltArmed] = useState(false);
  const [flash, setFlash] = useState("");
  const [bump, setBump] = useState<Pulse | null>(null);
  const [bloom, setBloom] = useState<Pulse | null>(null);
  const [trails, setTrails] = useState<IceTrails>({ a: null, b: null });
  // the solve as one value, produced at the win edge: the full raw event trace
  // (inputs + undo/reset — unlike `inputs`, it is NEVER popped, corrections
  // stay on the record) plus the winning line's move count, both derived from
  // the same history so they can't diverge. Null until solved.
  const [solve, setSolve] = useState<Solve | null>(null);
  // the solver's suggested next move (from the current state), and how many
  // hints have been consumed on this level. A single peek taints the level: its
  // solve is withheld, so it is never recorded nor auto-submitted to a
  // leaderboard. The count deliberately survives reset (R) — it clears only on
  // remount, i.e. a real level change (the screen is keyed by level). Otherwise
  // peek → memorise the move → R → replay clean would launder a hinted solve
  // into a record. The tutorial/demo runs on its own state (useGuidedDemo) and
  // never touches this, so nothing there is affected.
  const [hint, setHint] = useState<Input | null>(null);
  const [hints, setHints] = useState(0);
  // shown when a hint is asked for from a dead end (no line to the goal): the
  // solver finds nothing, so instead of a silent no-op we say so plainly
  const [hintNote, setHintNote] = useState("");
  // memoised solver answer per state hash, so re-reaching a state (undo,
  // reset-and-replay) answers a hint without re-running BFS. Kept for the
  // level's whole life — never cleared on reset.
  const hintCache = useRef<Map<number, Input | null>>(new Map());
  const history = useRef<GameState[]>([]);
  // mirror of `history`: the exact inputs applied, popped on undo
  const inputs = useRef<Input[]>([]);
  const trace = useRef<TraceStep[]>([]);
  const stampTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // the stamp must not sound after an undo or a level change
  const cancelStamp = () => clearTimeout(stampTimer.current);
  useEffect(() => cancelStamp, []);

  const solved = isWin(st, level);
  // null when the level offers no secondary gesture: Shift/arm falls back to move
  const altKind = altGesture(st, level);

  const play = (d: Pos, wantAlt = false) => {
    if (solved) return;
    const kind: Input["kind"] =
      (wantAlt || altArmed) && altKind ? altKind : "move";
    setAltArmed(false);
    const next = applyInput(st, level, { kind, dir: d });
    const sig = inputSignature(st, next, kind, level);
    fx[sig.fx]();
    if (sig.vibrate !== null) vibrate(sig.vibrate);
    if (!next) {
      setBump({ payload: d, t: Date.now() });
      if (kind === "split") setFlash(m.flash_no_split());
      if (kind === "shift") setFlash(m.flash_no_shift({ max: MAX_SHIFT }));
      setTimeout(() => setFlash(""), 1200);
      return;
    }
    // a merge is the headline event — announce it even when a shift caused it
    // (`next.merged` restates what sig already knows, purely to narrow the type)
    if (sig.fx === "merge" && next.merged) {
      setBloom({ payload: next.m, t: Date.now() });
      setTimeout(() => setBloom(null), 600);
    }
    // ice ink trails: from the cell left behind to the cell reached
    const ice = level.mods.includes("glace") && !st.merged && !next.merged;
    setTrails({
      a: ice && !eq(st.a, next.a) ? { from: st.a } : null,
      b: ice && !eq(st.b, next.b) ? { from: st.b } : null,
    });
    history.current.push(st);
    inputs.current.push({ kind, dir: d });
    trace.current.push({ kind, dir: d });
    setHint(null); // the move consumes any shown suggestion
    setHintNote("");
    setSt(next);
    setMoves((m) => m + 1);
    if (isWin(next, level)) {
      fx.win();
      vibrate([30, 60, 30]);
      // a hinted run is off the record: no solve to record or auto-submit —
      // but the win still counts as "solved with a hint" (a dim mark in the
      // selector), distinct from a clean record
      if (hints === 0) {
        setSolve({
          trace: trace.current.slice(),
          moves: history.current.length,
        });
        onWin?.(history.current.length);
      } else {
        onHintedWin?.();
      }
      stampTimer.current = setTimeout(() => fx.stamp(), 650);
    }
  };

  // reveal the next optimal move from the current state (BFS from here, via the
  // shared solver). One peek per pending suggestion, so re-clicking without
  // moving doesn't inflate the counter; boards are tiny so it's instant.
  const applyHint = (next: Input | null) => {
    if (!next) {
      // a bad merge strands the inks: most non-winning states of a level are
      // dead ends. Don't spend a hint on nothing — tell the player instead.
      setHintNote(m.controls_hint_none());
      setTimeout(() => setHintNote(""), 2600);
      return;
    }
    setHintNote("");
    setHint(next);
    setHints((n) => n + 1);
  };
  const showHint = () => {
    if (solved || hint) return;
    const key = hashState(st, level);
    const cached = hintCache.current.get(key);
    if (cached !== undefined) return applyHint(cached);
    // BFS is synchronous and can stall the thread ~28ms on desktop, several
    // times that on low-end mobile. Yield one frame first, so the button's
    // pressed state paints instead of the tap feeling dead; then solve, cache
    // the answer for this state, and reveal it.
    requestAnimationFrame(() => {
      const next = solveFrom(level, st)?.inputs[0] ?? null;
      hintCache.current.set(key, next);
      applyHint(next);
    });
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    inputs.current.pop();
    trace.current.push({ kind: "undo" }); // a correction — recorded, not popped
    cancelStamp();
    setSt(prev);
    setMoves((m) => m - 1);
    setAltArmed(false);
    setHint(null);
    setHintNote("");
    setTrails({ a: null, b: null });
    setSolve(null); // undoing leaves the won state
  };

  const reset = () => {
    cancelStamp();
    // only a reset that discards progress is a correction worth recording
    if (inputs.current.length) trace.current.push({ kind: "reset" });
    setSt(initialState(level));
    setMoves(0);
    setAltArmed(false);
    setFlash("");
    setBump(null);
    setBloom(null);
    setTrails({ a: null, b: null });
    setHint(null);
    setHintNote("");
    // NOTE: `hints` is intentionally NOT cleared here — the taint must outlive a
    // reset (see the state declaration). It resets only on remount / level change.
    history.current = [];
    inputs.current = [];
    setSolve(null);
  };

  return {
    st,
    moves,
    solved,
    altArmed,
    toggleAlt: () => altKind !== null && setAltArmed((v) => !v),
    // set the armed state directly (not toggled): the maintien-slide arms while
    // the finger is held and disarms on release, so it can't flip an existing
    // arm the wrong way. No-op when the state offers no alternate gesture.
    arm: (on: boolean) => altKind !== null && setAltArmed(on),
    flash,
    bump,
    bloom,
    iceTrailA: trails.a,
    iceTrailB: trails.b,
    solve,
    hint,
    hints,
    hintNote,
    showHint,
    play,
    undo,
    reset,
  };
}
