// First-encounter demos: at the first level that introduces a mechanic, the
// board plays it once with phantom pawns before handing over. Each demo is a
// synthetic open board + a start state + an input sequence, run through the
// SAME engine the game and solver share — so a demo can never show a rule the
// engine wouldn't actually apply. Rendering reuses Board in `ghost` mode.

import type {
  GameState,
  Input,
  Level,
  MechanicId,
  Pos,
} from "../engine/types.ts";
import { applyInput } from "../engine/successors.ts";

export interface Demo {
  id: string;
  covers: MechanicId[]; // one demo can teach several mechanics at once
  level: Level;
  start: GameState;
  inputs: Input[];
}

/** One played input: the resulting state (unchanged when `blocked`), plus flags
 *  the player turns into feedback — `blocked` bumps the box, `merged` blooms. */
export interface DemoStep {
  input: Input;
  state: GameState;
  blocked: boolean;
  merged: boolean; // this step transitioned into the merged state
}

const D: Pos = [1, 0];
const L: Pos = [0, -1];
const R: Pos = [0, 1];

// a demo board: an open grid, goals unused (a demo never wins)
const board = (
  over: Partial<Level> & Pick<Level, "size" | "mods" | "a" | "b">,
): Level => ({
  id: "demo",
  ch: "demo",
  name: "demo",
  ...over,
});

export const DEMOS: Demo[] = [
  // fusion + scission: cyan held by the left edge, magenta catches up → white,
  // then a downward split sends cyan down and magenta up.
  {
    id: "intro_fusion",
    covers: ["fusion", "scission"],
    level: board({
      size: 5,
      mods: ["fusion", "scission"],
      a: { start: [1, 0], goal: [0, 0], walls: [] },
      b: { start: [1, 2], goal: [0, 0], walls: [] },
    }),
    start: { merged: false, a: [1, 0], b: [1, 2], off: [0, 0] },
    inputs: [
      { kind: "move", dir: L },
      { kind: "move", dir: L },
      { kind: "split", dir: D },
    ],
  },
  // lumiere: the white pawn is stopped by the light square, then the inks glide
  // straight through the very same cell.
  {
    id: "intro_lumiere",
    covers: ["lumiere"],
    level: board({
      size: 5,
      mods: ["fusion", "scission", "lumiere"],
      lightWalls: [[1, 2]],
      a: { start: [1, 1], goal: [0, 0], walls: [] },
      b: { start: [1, 1], goal: [0, 0], walls: [] },
    }),
    start: { merged: true, m: [1, 1], off: [0, 0] },
    inputs: [
      { kind: "move", dir: R }, // blocked by the light square at [1,2]
      { kind: "split", dir: R }, // cyan lands ON the light cell — inks pass through
      { kind: "move", dir: R },
    ],
  },
  // glace: one push and both inks slide the length of the row until a wall stops
  // them.
  {
    id: "intro_glace",
    covers: ["glace"],
    level: board({
      size: 5,
      mods: ["glace"],
      a: { start: [1, 0], goal: [0, 0], walls: [[1, 3]] },
      b: { start: [3, 0], goal: [0, 0], walls: [[3, 3]] },
    }),
    start: { merged: false, a: [1, 0], b: [3, 0], off: [0, 0] },
    inputs: [{ kind: "move", dir: R }],
  },
  // decalage: the world gesture slides the magenta film one cell (marks go off),
  // then the reverse gesture realigns it.
  {
    id: "intro_decalage",
    covers: ["decalage"],
    level: board({
      size: 5,
      mods: ["fusion", "scission", "decalage"],
      a: { start: [2, 1], goal: [0, 0], walls: [] },
      b: { start: [2, 3], goal: [0, 0], walls: [] },
    }),
    start: { merged: false, a: [2, 1], b: [2, 3], off: [0, 0] },
    inputs: [
      { kind: "shift", dir: R },
      { kind: "shift", dir: L },
    ],
  },
];

/** Fold the demo's inputs through the engine into a list of played steps. */
export function demoSteps(demo: Demo): { start: GameState; steps: DemoStep[] } {
  let state = demo.start;
  const steps: DemoStep[] = [];
  for (const input of demo.inputs) {
    const next = applyInput(state, demo.level, input);
    if (next === null) {
      steps.push({ input, state, blocked: true, merged: false });
      continue;
    }
    steps.push({
      input,
      state: next,
      blocked: false,
      merged: !state.merged && next.merged,
    });
    state = next;
  }
  return { start: demo.start, steps };
}

/** The mechanics a level exposes to the player (light walls ⇒ lumiere). */
const mechanicsOf = (level: Level): MechanicId[] =>
  level.lightWalls?.length ? [...level.mods, "lumiere"] : level.mods;

/** The demo a level is "about": the LAST demo (in intro order) whose mechanic
 *  the level exposes — i.e. the newest mechanic introduced on this board. Used
 *  both for auto-play and for the replay control (independent of what's seen). */
export function levelDemo(level: Level): Demo | null {
  const present = new Set(mechanicsOf(level));
  let found: Demo | null = null;
  for (const demo of DEMOS) {
    if (demo.covers.some((m) => present.has(m))) found = demo;
  }
  return found;
}

/** The demo to auto-play on this level, or null once it has been seen. */
export function pickDemo(level: Level, seen: readonly string[]): Demo | null {
  const demo = levelDemo(level);
  return demo && !seen.includes(demo.id) ? demo : null;
}
