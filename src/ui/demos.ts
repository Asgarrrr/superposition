// First-encounter tutorials: at the first level that introduces a mechanic, the
// player performs its signature gesture on the ideal sandbox board, on rails.
// Each demo is a synthetic open board + a start state + a scripted sequence of
// beats, run through the SAME engine the game and solver share — so the
// tutorial can never ask for a gesture the engine wouldn't actually apply.

import type {
  GameState,
  Input,
  Level,
  MechanicId,
  Pos,
} from "../engine/types.ts";
import { applyInput } from "../engine/successors.ts";
import { m } from "../paraglide/messages.js";

/** One scripted gesture. `input` is the canonical script (drives demoSteps and
 *  the guidance arrow); `free` lets the tutorial accept ANY direction of the
 *  same kind (the engine arbitrates — an illegal choice bumps instead of
 *  advancing); `realign` expects the reverse of the previously chosen
 *  direction. `say` is the instruction shown before the gesture, `done` the
 *  payoff line shown right after it fires. */
export interface DemoBeat {
  input: Input;
  free?: boolean;
  realign?: boolean;
  say: () => string;
  done: () => string;
}

export interface Demo {
  id: string;
  covers: MechanicId[]; // one demo can teach several mechanics at once
  level: Level;
  start: GameState;
  title: () => string; // the mechanic's name, for the entrance card
  sub: () => string; // one poetic line under the title
  beats: DemoBeat[];
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
  // then a free split — any direction shows cyan following, magenta mirroring.
  {
    id: "intro_fusion",
    covers: ["fusion", "scission"],
    level: board({
      size: 5,
      mods: ["fusion", "scission"],
      a: { start: [1, 0], goal: [0, 0], walls: [] },
      b: { start: [1, 1], goal: [0, 0], walls: [] },
    }),
    start: { merged: false, a: [1, 0], b: [1, 1], off: [0, 0] },
    title: m.demo_title_fusion,
    sub: m.demo_sub_fusion,
    beats: [
      {
        input: { kind: "move", dir: L },
        say: m.demo_fusion_push,
        done: m.demo_fusion_merged,
      },
      {
        input: { kind: "split", dir: D },
        free: true, // the player verifies the mirror rule in the direction THEY pick
        say: m.demo_fusion_split,
        done: m.demo_fusion_split_done,
      },
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
    beats: [
      {
        input: { kind: "move", dir: R }, // blocked by the light: feel the wall
        say: m.demo_lumiere_push,
        done: m.demo_lumiere_blocked,
      },
      {
        input: { kind: "split", dir: R }, // cyan lands ON the light cell
        say: m.demo_lumiere_split,
        done: m.demo_lumiere_pass,
      },
    ],
    title: m.demo_title_lumiere,
    sub: m.demo_sub_lumiere,
  },
  // glace: one push and both inks slide the length of the row until a wall
  // stops them.
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
    title: m.demo_title_glace,
    sub: m.demo_sub_glace,
    beats: [
      {
        input: { kind: "move", dir: R },
        say: m.demo_glace_push,
        done: m.demo_glace_done,
      },
    ],
  },
  // decalage: any world gesture slides the magenta film (marks go off), then
  // the reverse gesture realigns it.
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
    title: m.demo_title_decalage,
    sub: m.demo_sub_decalage,
    beats: [
      {
        input: { kind: "shift", dir: R },
        free: true,
        say: m.demo_shift_do,
        done: m.demo_shift_off,
      },
      {
        input: { kind: "shift", dir: L },
        realign: true, // the reverse of whatever the player chose
        say: m.demo_shift_back,
        done: m.demo_shift_aligned,
      },
    ],
  },
];

/** One played input: the resulting state (unchanged when `blocked`), plus flags
 *  the player turns into feedback — `blocked` bumps the box, `merged` blooms. */
export interface DemoStep {
  input: Input;
  state: GameState;
  blocked: boolean;
  merged: boolean; // this step transitioned into the merged state
}

/** Fold the demo's canonical script through the engine into played steps. */
export function demoSteps(demo: Demo): { start: GameState; steps: DemoStep[] } {
  let state = demo.start;
  const steps: DemoStep[] = [];
  for (const { input } of demo.beats) {
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
    if (demo.covers.some((mech) => present.has(mech))) found = demo;
  }
  return found;
}

/** The demo to auto-play on this level, or null once it has been seen. */
export function pickDemo(level: Level, seen: readonly string[]): Demo | null {
  const demo = levelDemo(level);
  return demo && !seen.includes(demo.id) ? demo : null;
}
