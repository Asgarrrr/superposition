// Sensory signatures — one per game verb, never decorative.
// block 95 Hz, merge = two sines toward unison, split =
// diverging chord, offset = 62 Hz rumble, win = arpeggio.

import { useEffect } from "react";
import { useMuted } from "./useMuted.ts";

export interface SoundFx {
  move: () => void;
  slide: () => void;
  block: () => void;
  merge: () => void;
  split: () => void;
  shift: () => void;
  win: () => void;
  stamp: () => void;
  tick: () => void; // soft refusal (tutorial): heard, not punished
}

// One AudioContext for the whole session, created lazily on the first tone and
// reused across route remounts. Routes mount/unmount as you navigate, so a
// per-hook context would abandon one AudioContext per level entry and hit the
// browser's hard cap (~6) — a throw in the middle of a move. Module scope keeps
// it a singleton; the mute flag lives alongside it.
let ctx: AudioContext | null = null;
let isMuted = false;

const tone = (
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.04,
  glideTo: number | null = null,
) => {
  if (isMuted) return;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return; // no Web Audio: silent but still playable
    try {
      ctx = new AC();
    } catch {
      return; // e.g. the browser's AudioContext cap — stay silent, never throw
    }
  }
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (glideTo)
    o.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
};

const fx: SoundFx = {
  move: () => tone(340, 0.06, "triangle", 0.03),
  slide: () => tone(220, 0.16, "triangle", 0.03, 420),
  block: () => tone(95, 0.09, "sine", 0.06),
  merge: () => {
    tone(392, 0.22, "sine", 0.045, 523);
    tone(523, 0.22, "sine", 0.045);
  },
  split: () => {
    tone(523, 0.16, "sine", 0.04, 392);
    tone(494, 0.16, "sine", 0.04, 349);
  },
  shift: () => tone(62, 0.22, "sine", 0.07, 55),
  win: () => {
    tone(523, 0.4, "sine", 0.05);
    setTimeout(() => tone(659, 0.5, "sine", 0.05), 120);
    setTimeout(() => tone(784, 0.7, "sine", 0.05), 240);
  },
  stamp: () => tone(70, 0.14, "square", 0.05),
  tick: () => tone(180, 0.04, "triangle", 0.025),
};

const setMuted = (v: boolean) => {
  isMuted = v;
};

export function useSound() {
  return { fx, setMuted };
}

// Sound wired to the persisted mute setting — the audio engine, the toggle, and
// localStorage persistence in one place, so every play route shares the exact
// same block instead of copy-pasting the useSound + useMuted + sync trio.
export function usePersistedSound() {
  const { fx, setMuted } = useSound();
  const [muted, toggleMuted] = useMuted();
  // `setMuted` is a stable module reference, so this fires only when `muted`
  // flips, not on every render
  useEffect(() => setMuted(muted), [muted, setMuted]);
  return { fx, muted, toggleMuted };
}
