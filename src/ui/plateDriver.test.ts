// The mapping from a session (real or guided) to the board and the controls.
// These are the rules that used to live as `demoActive ? … : …` branches inside
// PlayScreen, where nothing could reach them: which gesture arms, which control
// lights, whether a swipe carries its own alt, what a hold does on a sandbox.

import { describe, expect, it, vi } from "vitest";
import type { GameState, Level } from "../engine/types.ts";
import { testLevel } from "../engine/testing.ts";
import type { GuidedDemo } from "./hooks/useDemo.ts";
import type { useGame } from "./hooks/useGame.ts";
import {
  altLabelFor,
  guidedPlate,
  hintHighlight,
  playingPlate,
} from "./plateDriver.ts";

const layer = (start: [number, number], goal: [number, number]) => ({
  start,
  goal,
  walls: [],
});

/** A plain level: no merge in sight, no decalage — so no alt gesture. */
const PLAIN: Level = testLevel({
  size: 3,
  a: layer([0, 0], [2, 2]),
  b: layer([0, 2], [2, 0]),
});
const DECALAGE: Level = testLevel({
  size: 3,
  mods: ["decalage"],
  a: layer([0, 0], [2, 2]),
  b: layer([0, 2], [2, 0]),
});

const APART: GameState = { merged: false, a: [0, 0], b: [0, 2], off: [0, 0] };
const MERGED: GameState = { merged: true, m: [1, 1], off: [0, 0] };

type Game = ReturnType<typeof useGame>;

function fakeGame(over: Partial<Game> = {}): Game {
  return {
    st: APART,
    moves: 0,
    solved: false,
    altArmed: false,
    toggleAlt: vi.fn(),
    arm: vi.fn(),
    flash: "",
    bump: null,
    bloom: null,
    iceTrailA: null,
    iceTrailB: null,
    solve: null,
    hint: null,
    hints: 0,
    hintNote: "",
    showHint: vi.fn(),
    play: vi.fn(),
    undo: vi.fn(),
    reset: vi.fn(),
    ...over,
  };
}

function fakeGuided(over: Partial<GuidedDemo> = {}): GuidedDemo {
  return {
    active: true,
    phase: "play",
    waiting: false,
    level: PLAIN,
    st: APART,
    armed: false,
    bump: null,
    bloom: null,
    nudge: null,
    caption: null,
    ghosts: null,
    guides: [],
    guidance: { arm: false, dir: null, any: false },
    press: vi.fn(),
    arm: vi.fn(),
    next: vi.fn(),
    skip: vi.fn(),
    ...over,
  };
}

describe("altLabelFor", () => {
  it("names the split on a merged state and the world shift on decalage", () => {
    expect(altLabelFor(MERGED, PLAIN)).toBeTruthy();
    expect(altLabelFor(APART, DECALAGE)).toBeTruthy();
    expect(altLabelFor(MERGED, PLAIN)).not.toBe(altLabelFor(APART, DECALAGE));
  });

  it("names nothing when the state offers no alt gesture", () => {
    expect(altLabelFor(APART, PLAIN)).toBeNull();
  });
});

describe("hintHighlight", () => {
  it("lights nothing without a hint", () => {
    expect(hintHighlight(null, false)).toBeUndefined();
  });

  it("lights the arrow for a plain move", () => {
    expect(hintHighlight({ kind: "move", dir: [1, 0] }, false)).toEqual({
      arm: false,
      dir: [1, 0],
    });
  });

  it("lights the arm control first for a split, then the arrow", () => {
    const hint = { kind: "split", dir: [1, 0] } as const;
    // unarmed: the arrow must stay dark, or a bare press slips through as an
    // ordinary move while the hint points at a gesture it didn't perform
    expect(hintHighlight(hint, false)).toEqual({ arm: true, dir: null });
    expect(hintHighlight(hint, true)).toEqual({ arm: false, dir: [1, 0] });
  });
});

describe("playingPlate", () => {
  it("drives a real plate: no sandbox, no frame, no guides", () => {
    const d = playingPlate(fakeGame(), PLAIN, null);
    expect(d.sandbox).toBe(false);
    expect(d.framed).toBe(false);
    expect(d.guides).toEqual([]);
    expect(d.guideGhosts).toBeNull();
  });

  it("arms on a hold only when the state offers an alt gesture", () => {
    const armable = fakeGame({ st: MERGED });
    playingPlate(armable, PLAIN, null).hold(true);
    expect(armable.arm).toHaveBeenCalledWith(true);

    const plain = fakeGame({ st: APART });
    playingPlate(plain, PLAIN, null).hold(true);
    expect(plain.arm).not.toHaveBeenCalled();
  });

  it("previews the aim only where an alt gesture exists to preview", () => {
    expect(
      playingPlate(fakeGame({ st: MERGED }), PLAIN, null).previewsAim,
    ).toBe(true);
    expect(playingPlate(fakeGame({ st: APART }), PLAIN, null).previewsAim).toBe(
      false,
    );
  });

  it("lets a swipe carry its own alt — that IS the arm on a real plate", () => {
    const game = fakeGame();
    playingPlate(game, PLAIN, null).swipe([1, 0], true);
    expect(game.play).toHaveBeenCalledWith([1, 0], true);
  });

  it("defaults a press with no alt to a plain move", () => {
    const game = fakeGame();
    playingPlate(game, PLAIN, null).press([1, 0]);
    expect(game.play).toHaveBeenCalledWith([1, 0], false);
  });

  it("offers Enter only once solved, and never a tap", () => {
    const onNext = vi.fn();
    expect(playingPlate(fakeGame(), PLAIN, onNext).advance).toBeNull();
    expect(
      playingPlate(fakeGame({ solved: true }), PLAIN, onNext).advance,
    ).toBe(onNext);
    // a stray tap on the plate must never spend the win
    expect(
      playingPlate(fakeGame({ solved: true }), PLAIN, onNext).tapAdvance,
    ).toBeNull();
  });

  it("passes the reset through (the hold is what gates it, not the driver)", () => {
    const game = fakeGame();
    playingPlate(game, PLAIN, null).reset();
    expect(game.reset).toHaveBeenCalled();
  });
});

describe("guidedPlate", () => {
  it("declines to drive when no demo is running", () => {
    expect(guidedPlate(fakeGuided({ active: false }))).toBeNull();
    expect(guidedPlate(fakeGuided({ st: null }))).toBeNull();
    expect(guidedPlate(fakeGuided({ level: null }))).toBeNull();
  });

  it("drives the sandbox, and never reports a win", () => {
    const d = guidedPlate(fakeGuided())!;
    expect(d.sandbox).toBe(true);
    expect(d.solved).toBe(false);
  });

  it("drops the tape frame at the handoff while still a sandbox", () => {
    expect(guidedPlate(fakeGuided({ phase: "play" }))!.framed).toBe(true);
    const handoff = guidedPlate(fakeGuided({ phase: "handoff" }))!;
    expect(handoff.framed).toBe(false);
    expect(handoff.sandbox).toBe(true);
  });

  it("strips a swipe's alt so a held push on a plain beat stays a plain move", () => {
    const guided = fakeGuided();
    guidedPlate(guided)!.swipe([1, 0], true);
    expect(guided.press).toHaveBeenCalledWith([1, 0], false);
  });

  it("still lets a Shift press arm and play in one gesture", () => {
    const guided = fakeGuided();
    guidedPlate(guided)!.press([1, 0], true);
    expect(guided.press).toHaveBeenCalledWith([1, 0], true);
  });

  it("arms on a hold only on the beat that asks for it", () => {
    const armBeat = fakeGuided({
      guidance: { arm: true, dir: null, any: false },
    });
    guidedPlate(armBeat)!.hold(true);
    expect(armBeat.arm).toHaveBeenCalled();

    const moveBeat = fakeGuided();
    guidedPlate(moveBeat)!.hold(true);
    expect(moveBeat.arm).not.toHaveBeenCalled();
  });

  it("never arms on the release of a hold", () => {
    const armBeat = fakeGuided({
      guidance: { arm: true, dir: null, any: false },
    });
    guidedPlate(armBeat)!.hold(false);
    expect(armBeat.arm).not.toHaveBeenCalled();
  });

  it("swallows undo and reset — a sandbox has no run to correct", () => {
    const guided = fakeGuided();
    const d = guidedPlate(guided)!;
    expect(() => {
      d.undo();
      d.reset();
    }).not.toThrow();
    expect(guided.press).not.toHaveBeenCalled();
  });

  it("advances on Enter and on a tap, at the player's own pace", () => {
    const guided = fakeGuided();
    const d = guidedPlate(guided)!;
    d.advance!();
    d.tapAdvance!();
    expect(guided.next).toHaveBeenCalledTimes(2);
  });
});
