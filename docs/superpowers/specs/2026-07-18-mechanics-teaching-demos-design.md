# First-encounter mechanic demos

Status: v1 (autoplay) shipped; pivoting to v2 (guided, on-rails) — see "Revision"
at the end.

## Problem

New mechanics are introduced fast — a poetic one-line hint per level, then
"figure it out." Two symptoms observed with real players:

- **They don't notice the new mechanic.** Mechanics are stacked chapter after
  chapter (e.g. _Trinité_ adds `glace` on top of `lumiere`); the only signal is
  the chapter name and a small, grey rule line.
- **They're blocked without understanding why.** The directional semantics of a
  mechanic are invisible. The archetype: on a split, cyan follows the arrow and
  magenta mirrors it — this is never shown, and the text that gestures at it is
  tiny (`text-[11.5px]` at 28% opacity).

A complementary point-of-use fix already shipped (`bd4548b`): while `✕` is
armed, each ink's split landing cell is previewed as a ghost dot. That teaches
the split at the moment of use but does not cover the other mechanics or the
"first encounter" moment.

## Decision

Teach each mechanic with an **animated demonstration on the real board at first
encounter**, before the player takes control. Chosen through brainstorming:

- **When:** at the first encounter of a mechanic (before acting).
- **How:** the board plays the mechanic itself — show, don't tell. No text
  legend.
- **Where:** on the real board, with phantom pawns, which then dissolve so the
  real pawns settle in.
- **Choreography:** an _ideal staging_ per mechanic (phantoms placed for maximum
  clarity, independent of the puzzle; the real walls are dimmed during the
  demo). One reusable choreography per mechanic, not per level.
- **Recurrence:** plays once automatically (persisted), then never by default; a
  discreet control replays it on demand.

## Approach — engine-driven

Each demo is a synthetic open board (`Level` with the mechanic's mods, no real
walls) + a start `GameState` + an `Input[]` sequence. Frames are produced by
running the sequence through the real engine (`applyInput`). Rendering reuses
`InkLayer` in a ghost palette. Because the demo runs on the same deterministic
engine the game and solver share, **it cannot show a rule the engine wouldn't
actually apply.** The only new code is the frame player, the ghost render layer,
and the seen/trigger logic.

Rejected alternatives: hand-authored keyframes (duplicates rule/motion logic,
can drift from the engine); driving the real `useGame` in autoplay (heaviest
coupling — entangles the demo with undo/win/sound state).

## Units

1. **`src/ui/demos.ts` — demo data + step derivation.**
   `Demo = { id, covers: MechanicId[], level: Level, start: GameState, inputs:
Input[] }`. `covers` lets one demo teach several mechanics at once (the intro
   demo covers `fusion` and `scission`). A pure `demoSteps(demo)` folds `inputs`
   through `applyInput` from `start` and returns `{ start, steps: DemoStep[] }`
   where `DemoStep = { input, state, blocked, merged }`: `blocked` is set when
   `applyInput` returns `null` (state unchanged — used to teach "white can't
   pass light"), `merged` when a step transitions into the merged state (drives
   the bloom). No hand-placed positions.

2. **`useDemoPlayer` (hook) — the frame player.**
   Takes a demo, advances through steps on a timer, exposes
   `{ level, st, bump, bloom, active }` and `skip()`: `st` is the current frame's
   state, `bump`/`bloom` are `Pulse`s emitted on blocked / merge steps (the same
   props `Board` already consumes). Under `reducedMotion`, jumps to the final
   state with no animation. Knows nothing about the real game. Clears its timer
   on skip / unmount so no late frame repaints after the demo lifts.

3. **`Board` ghost mode — reuse, not a new layer.**
   Rendering reuses `Board` unchanged via a new `ghost?: boolean` prop: while a
   demo is active, `PlayScreen` renders `<Board ghost level={demo.level}
st={player.st} bump={player.bump} bloom={player.bloom} />` — a separate
   instance from the real board, with no swipe / overlay / children. `ghost`
   dims the whole box (reduced opacity, no win overlay). This reuses every bit
   of `Board`'s rendering for free — registration marks for `decalage`, the
   merge bloom for `fusion`, the light squares for `lumiere`, the world-slide
   for `off` — so the demo cannot look different from real play. The real
   `Board` is gated behind `!demoActive`, so it mounts (and plays its
   develop-in) exactly when the demo lifts and the real pawns settle in.

4. **Trigger + persistence (`useDemoGate` or logic in `PlayScreen`).**
   On level mount, list mechanics present (`level.mods`, plus `lumiere` when
   `lightWalls` is non-empty). Find the first demo whose `covers` intersects an
   unseen mechanic; if any, enter demo mode. "Unseen" comes from persisted
   state, not a hard-coded level id (robust if the player deep-links to a later
   level). Persist seen demo ids in `localStorage` (key `sp:demos-seen`),
   following the `useBestScores` pattern.

5. **`PlayScreen` integration.**
   While a demo is active, `game.play` is suppressed (any input skips instead);
   `exit` stays live. A discreet replay control (`↻ démo`) shows on levels that
   have a demo and re-triggers it without touching seen state. When the demo
   lifts, the existing develop-in resumes and play is enabled.

## Demo choreographies

All on an open 5×5 grid. Three carry their own dimmed phantom element.

- **`intro_fusion` (covers `fusion` + `scission`)** — _Blanc_. Cyan phantom at
  the left edge, magenta two cells away. Two pushes left: cyan is already held
  by the edge, magenta catches up → **merge to white** (existing bloom). Pause,
  then a split downward: **cyan goes down, magenta goes up** — divergence
  explicit. Also teaches the game's core truth: you close the gap using terrain.
- **`intro_lumiere`** — _Éclipse_. Start already merged, a phantom light square
  in the middle. One push toward it → **blocked** (white can't enter light).
  Then split, and the two inks glide across the light square's column **without
  being stopped**. Both halves of the rule in one pass.
- **`intro_glace`** — _Trinité_. Two phantom inks at the left, a phantom wall at
  the right. One push → they **slide** until they stop against the wall
  (existing ice trails). One input, a long slide, a stop.
- **`intro_decalage`** — _Dérive_. Two phantom inks, registration marks aligned.
  A "world" gesture → the **magenta film slides one cell**, the marks visibly go
  **off**. Then the reverse gesture → the marks **realign**.

## Edge cases

- **Multiple new mechanics on one level.** _Blanc_ introduces `fusion` +
  `scission` → one demo (`covers: [fusion, scission]`) covers both. Rule: at
  most one demo per mount; with the four demos defined this is the only
  multi-mechanic level and it is covered.
- **Daily mode.** No demos in daily — it is an expert mode outside the learning
  path. Demos are campaign-only.
- **`localStorage` unavailable** (strict private browsing): degrade to
  "play every entry, skippable" rather than throw.
- **Skip mid-animation.** The player stops immediately and clears its timer; no
  stale frame repaints after the demo lifts.

## Testing

- **Engine-verifiable (no browser).** For each demo, run `start` + `inputs`
  through `applyInput` and assert the mechanic's invariant: `intro_fusion`
  reaches a merged state then splits into two distinct inks with cyan/magenta on
  opposite sides; `intro_lumiere` has one blocked input (white on light) then an
  ink passing through the same cell; `intro_glace` slides more than one cell and
  stops against the wall; `intro_decalage` moves `off` from `[0,0]` to offset
  then back. Guarantees a demo can never show a false rule.
- **Trigger/persistence logic.** Unseen mechanic triggers; once seen, does not;
  a level with no demo triggers nothing.
- **Visual (browser).** Ghost legibility, real content dimmed, clean dissolve to
  the real pawns, immediate skip, replay control — checked on _Blanc, Éclipse,
  Trinité, Dérive_.

## Relationship to the shipped split preview

The armed-split preview (`bd4548b`) stays as point-of-use reinforcement; the
demo is the first-encounter teach. Complementary. The optional hover-on-arrow
refinement of the preview remains deferred.

## Revision — v2: guided, on-rails interactive tutorial

v1 (autoplay) played three moves with no framing: the player watched movement
without a reason to. The pivot makes it an **experience** — the player _performs_
the mechanic's signature gesture themselves, on rails, on the ideal sandbox
board, guided step by step. The "no text" constraint is lifted: **on-board text
and callouts are allowed** — this is a real little tutorial.

**Interaction (on rails).** Only the scripted gesture advances; other inputs do
nothing (a soft refusal). The player uses the real controls (arrows, ✕, world).
Each step:

1. An on-board caption states the gesture in plain words.
2. The expected control **lights up and pulses**; the others dim. A ghost hint on
   the board shows where it lands (the split preview's ghosts are reused for the
   split beat).
3. The player performs it → the mechanic fires with emphasis (bloom for merge,
   diverging inks for split, recoil + flash for a light block, amplified trail
   for ice, registration-mark pulse for offset), plus its sound.
4. A short beat, then the next caption — or, after the last, the real level
   develops in.

**Per-mechanic scripts (minimal signature).**

- `intro_fusion` — bring them together (one push, edge catch-up) → merge to white;
  then ✕ + a direction → split, inks diverge.
- `intro_lumiere` — push the white pawn into the light → blocked (feel the wall);
  then ✕ + a direction → an ink lands on the light cell (inks pass through).
- `intro_glace` — one push → the ink slides the length of the row and stops.
- `intro_decalage` — a world gesture → the film slides, marks go off; the reverse
  gesture → marks realign.

**Units (delta from v1).**

- `demos.ts` — reused; `intro_fusion` starts one cell from merging and
  `intro_lumiere` drops its trailing move, so each script is the minimal signature.
  `demoSteps` still derives the scripted states/flags from the engine.
- `useGuidedDemo` **replaces** `useDemoPlayer`: a purpose-built on-rails stepper
  holding the sandbox state, the expected input, an `armed` sub-state (for
  split/world), and the bump/bloom/sound of the last accepted gesture. Exposes
  `press(dir)` / `arm()` that accept only the scripted gesture and advance, plus
  `guidance` (which control to light up) and `caption`.
- `Controls` — a `highlight` prop pulses the expected arrow / alt control and a
  `guiding` prop hides undo/reset during the tutorial.
- A small on-board caption/callout (rendered as `Board` children, like the win
  overlay) shows the step's instruction. The contextual `ruleLine` copy is reused
  where it fits, shown prominently (which also answers "the hint is too small").
- Skip becomes an explicit control (inputs now drive the tutorial, so they can no
  longer double as skip). Seen-once persistence and the replay control are reused.

`useSeenDemos`, `pickDemo` / `levelDemo`, and the `Board` ghost prop stay. The
autoplay `useDemoPlayer` is removed.
