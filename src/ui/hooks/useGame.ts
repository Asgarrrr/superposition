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
import { initialState, isWin, MAX_SHIFT } from "../../engine/state.ts";
import { applyInput } from "../../engine/successors.ts";
import { eq } from "../../engine/grid.ts";
import { m } from "../../paraglide/messages.js";
import { vibrate } from "../haptics.ts";
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
  onWin?: (moves: number, inputs: Input[]) => void,
) {
  const [st, setSt] = useState<GameState>(() => initialState(level));
  const [moves, setMoves] = useState(0);
  const [altArmed, setAltArmed] = useState(false);
  const [flash, setFlash] = useState("");
  const [bump, setBump] = useState<Pulse | null>(null);
  const [bloom, setBloom] = useState<Pulse | null>(null);
  const [trails, setTrails] = useState<IceTrails>({ a: null, b: null });
  // the winning input sequence, exposed once solved so the daily overlay can
  // submit it for server-side replay
  const [wonInputs, setWonInputs] = useState<Input[]>([]);
  // the full raw event trace (inputs + undo/reset), exposed once solved so the
  // campaign leaderboard can replay it and count corrections (a clean solve has
  // none). Unlike `inputs`, it is NEVER popped — corrections stay on the record.
  const [wonTrace, setWonTrace] = useState<TraceStep[]>([]);
  const history = useRef<GameState[]>([]);
  // mirror of `history`: the exact inputs applied, popped on undo
  const inputs = useRef<Input[]>([]);
  const trace = useRef<TraceStep[]>([]);
  const stampTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // the stamp must not sound after an undo or a level change
  const cancelStamp = () => clearTimeout(stampTimer.current);
  useEffect(() => cancelStamp, []);

  const solved = isWin(st, level);
  // the alt gesture only exists where the level supports it (mirrors
  // PlayScreen's altLabel) — otherwise Shift/arm falls back to a move
  const altAvailable = st.merged || level.mods.includes("decalage");

  const play = (d: Pos, wantAlt = false) => {
    if (solved) return;
    const alt = (wantAlt || altArmed) && altAvailable;
    const kind: Input["kind"] = alt ? (st.merged ? "split" : "shift") : "move";
    setAltArmed(false);
    const next = applyInput(st, level, { kind, dir: d });
    if (!next) {
      fx.block();
      vibrate(25);
      setBump({ payload: d, t: Date.now() });
      if (kind === "split") setFlash(m.flash_no_split());
      if (kind === "shift") setFlash(m.flash_no_shift({ max: MAX_SHIFT }));
      setTimeout(() => setFlash(""), 1200);
      return;
    }
    // a merge is the headline event — announce it even when a shift caused it
    if (!st.merged && next.merged) {
      fx.merge();
      vibrate([10, 20, 40]);
      setBloom({ payload: next.m, t: Date.now() });
      setTimeout(() => setBloom(null), 600);
    } else if (kind === "shift") {
      fx.shift();
      vibrate(40);
    } else if (kind === "split") {
      fx.split();
      vibrate([15, 30, 15]);
    } else if (level.mods.includes("glace")) fx.slide();
    else fx.move();
    // ice ink trails: from the cell left behind to the cell reached
    const ice = level.mods.includes("glace") && !st.merged && !next.merged;
    setTrails({
      a: ice && !eq(st.a, next.a) ? { from: st.a } : null,
      b: ice && !eq(st.b, next.b) ? { from: st.b } : null,
    });
    history.current.push(st);
    inputs.current.push({ kind, dir: d });
    trace.current.push({ kind, dir: d });
    setSt(next);
    setMoves((m) => m + 1);
    if (isWin(next, level)) {
      fx.win();
      vibrate([30, 60, 30]);
      const won = inputs.current.slice();
      setWonInputs(won);
      setWonTrace(trace.current.slice());
      onWin?.(history.current.length, won);
      stampTimer.current = setTimeout(() => fx.stamp(), 650);
    }
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
    setTrails({ a: null, b: null });
    setWonInputs([]); // undoing leaves the won state
    setWonTrace([]);
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
    history.current = [];
    inputs.current = [];
    setWonInputs([]);
    setWonTrace([]);
  };

  return {
    st,
    moves,
    solved,
    altArmed,
    toggleAlt: () => altAvailable && setAltArmed((v) => !v),
    flash,
    bump,
    bloom,
    iceTrailA: trails.a,
    iceTrailB: trails.b,
    wonInputs,
    wonTrace,
    play,
    undo,
    reset,
  };
}
