// The plate driver: whatever is putting a plate on the table.
//
// Two things can drive the board — the real play session (useGame) and the
// on-rails tutorial (useGuidedDemo). They differ in almost nothing the board and
// the controls actually need, so this names the interface they both satisfy and
// gives each a pure adapter. PlayScreen binds ONE driver and writes the board's
// prop list once, instead of asking "is the tutorial live?" at every input site
// and rendering two nearly identical boards that must be kept in step by hand.
//
// Both adapters are plain functions, not hooks: the hooks own the state, this
// owns the mapping. That is what makes the mapping testable without a mount —
// which gesture arms, which control lights, whether a swipe carries its own alt,
// what a held reset does on a sandbox. Those were the rules most likely to drift
// between the two boards, and none of them could be tested before.

import type { GameState, Input, Level, Pos } from "../engine/types.ts";
import { m } from "../paraglide/messages.js";
import { altGesture } from "./altGesture.ts";
import { vibrate } from "./haptics.ts";
import type { DemoGuide, GuidedDemo } from "./hooks/useDemo.ts";
import type { Pulse, useGame } from "./hooks/useGame.ts";

/** The ink trail left behind by a slide on ice. */
type IceTrail = { from: Pos } | null;

/** Which control to light next: the arm control, an arrow, or every arrow. */
export interface Highlight {
  arm: boolean;
  dir: Pos | null;
  any?: boolean;
}

/** Everything the board and the controls need, whoever is driving. */
export interface PlateDriver {
  /** The plate on the table — the real level, or the tutorial's sandbox. */
  level: Level;
  st: GameState;
  solved: boolean;
  armed: boolean;
  bump: Pulse | null;
  bloom: Pulse | null;
  iceTrailA: IceTrail;
  iceTrailB: IceTrail;
  /** Not a plate of the edition: the tutorial's sandbox, which offers no
   *  corrections (there is no run to correct). */
  sandbox: boolean;
  /** Draw the tape frame, so the sandbox can't be mistaken for a level. Drops
   *  at the handoff while `sandbox` still holds — the frame fades before the
   *  real plate develops in. */
  framed: boolean;
  guideGhosts: { a: Pos[]; b: Pos[] } | null;
  guides: DemoGuide[];
  /** Whether a held slide should stream its aimed direction, narrowing the
   *  split preview to the move about to fire. */
  previewsAim: boolean;
  altLabel: string | null;
  highlight: Highlight | undefined;
  /** A key press or an on-screen arrow. `alt` is Shift: arm and play at once. */
  press: (dir: Pos, alt?: boolean) => void;
  /** A swipe. Kept apart from `press` because the maintien-slide arms through
   *  `hold`, so on the sandbox the swipe itself must NOT also carry its alt —
   *  a held push on a plain move-beat has to stay a plain move. */
  swipe: (dir: Pos, alt: boolean) => void;
  toggleArm: () => void;
  /** The maintien-slide dwell opened (true) or released (false). */
  hold: (held: boolean) => void;
  undo: () => void;
  reset: () => void;
  /** Enter. Null when there is nothing to advance to. */
  advance: (() => void) | null;
  /** A tap anywhere on the plate advances — the tutorial paces itself, so
   *  nothing there is on a timer. Null on a real plate, where a stray tap must
   *  never spend the win. */
  tapAdvance: (() => void) | null;
}

/** The label for the state's alt gesture. The rule itself lives in
 *  altGesture.ts; this only names it. Identical for both drivers — the sandbox
 *  is a real level to the engine, so it earns its label the same way. */
export function altLabelFor(st: GameState, level: Level): string | null {
  switch (altGesture(st, level)) {
    case "split":
      return m.controls_split();
    case "shift":
      return m.controls_world();
    case null:
      return null;
  }
}

/** The hint spotlights the control to press next in two beats, mirroring the
 *  guided demo: a split/world hint lights ONLY the arm control until the state
 *  is armed, then the arrow. Lighting both at once let a bare arrow press slip
 *  through as an ordinary move — the hint pointing at a gesture the press
 *  didn't perform. */
export function hintHighlight(
  hint: Input | null,
  armed: boolean,
): Highlight | undefined {
  if (!hint) return undefined;
  return hint.kind !== "move" && !armed
    ? { arm: true, dir: null }
    : { arm: false, dir: hint.dir };
}

/** The real play session driving a plate of the edition. `onNext` is what Enter
 *  reaches for once the plate is solved — null on the last plate. */
export function playingPlate(
  game: ReturnType<typeof useGame>,
  level: Level,
  onNext: (() => void) | null,
): PlateDriver {
  // only arm when the state actually offers an alt gesture, so a hold on a
  // plain level stays a plain move rather than buzzing at nothing
  const altAvailable = altGesture(game.st, level) !== null;
  return {
    level,
    st: game.st,
    solved: game.solved,
    armed: game.altArmed,
    bump: game.bump,
    bloom: game.bloom,
    iceTrailA: game.iceTrailA,
    iceTrailB: game.iceTrailB,
    sandbox: false,
    framed: false,
    guideGhosts: null,
    guides: [],
    previewsAim: altAvailable,
    altLabel: altLabelFor(game.st, level),
    highlight: hintHighlight(game.hint, game.altArmed),
    press: (dir, alt = false) => game.play(dir, alt),
    swipe: (dir, alt) => game.play(dir, alt),
    toggleArm: game.toggleAlt,
    hold: (held) => {
      if (!altAvailable) return;
      game.arm(held);
      if (held) vibrate([10]);
    },
    undo: game.undo,
    reset: () => {
      vibrate(18);
      game.reset();
    },
    advance: game.solved ? onNext : null,
    tapAdvance: null,
  };
}

/** The tutorial driving its sandbox, or null when no demo is running — so the
 *  caller reads `guidedPlate(guided) ?? playingPlate(...)` and the question
 *  "who is driving?" is asked exactly once. */
export function guidedPlate(guided: GuidedDemo): PlateDriver | null {
  if (!guided.active || !guided.level || !guided.st) return null;
  const { level, st } = guided;
  return {
    level,
    st,
    // a demo never wins: its board has no goals to reach
    solved: false,
    armed: guided.armed,
    bump: guided.bump,
    bloom: guided.bloom,
    iceTrailA: null,
    iceTrailB: null,
    sandbox: true,
    framed: guided.phase !== "handoff",
    guideGhosts: guided.ghosts,
    guides: guided.guides,
    previewsAim: false,
    altLabel: altLabelFor(st, level),
    highlight: guided.guidance,
    press: (dir, alt = false) => guided.press(dir, alt),
    // the swipe drops its alt: on the sandbox the arming happened through
    // `hold` already, and carrying it here would fire a gesture the beat never
    // asked for
    swipe: (dir) => guided.press(dir, false),
    toggleArm: guided.arm,
    hold: (held) => {
      // arm ONLY on the beat that asks for it — a hold on a plain push would
      // otherwise fire a split/world the tutorial never scripted
      if (held && guided.guidance.arm) {
        guided.arm();
        vibrate([10]);
      }
    },
    // the sandbox has no run to correct, and the controls hide both anyway
    undo: () => {},
    reset: () => {},
    advance: guided.next,
    tapAdvance: guided.next,
  };
}
