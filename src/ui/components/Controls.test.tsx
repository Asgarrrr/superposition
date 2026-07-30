// The controls, driven through a real plate driver rather than hand-written
// props — so this checks the thing that actually matters: that the two drivers
// produce genuinely different control surfaces, and that each one's rules reach
// the DOM. The driver's own mapping is unit-tested in plateDriver.test.ts; this
// is the other half, where the interface meets the buttons.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GameState, Level } from "../../engine/types.ts";
import { testLevel } from "../../engine/testing.ts";
import type { GuidedDemo } from "../hooks/useDemo.ts";
import type { useGame } from "../hooks/useGame.ts";
import { guidedPlate, playingPlate, type PlateDriver } from "../plateDriver.ts";
import { Controls } from "./Controls.tsx";

const LEVEL: Level = testLevel({
  size: 3,
  a: { start: [0, 0], goal: [2, 2], walls: [] },
  b: { start: [0, 2], goal: [2, 0], walls: [] },
});
const MERGED: GameState = { merged: true, m: [1, 1], off: [0, 0] };
const APART: GameState = { merged: false, a: [0, 0], b: [0, 2], off: [0, 0] };

type Game = ReturnType<typeof useGame>;

const fakeGame = (over: Partial<Game> = {}): Game =>
  ({
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
  }) as Game;

const fakeGuided = (over: Partial<GuidedDemo> = {}): GuidedDemo =>
  ({
    active: true,
    phase: "play",
    waiting: false,
    level: LEVEL,
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
  }) as GuidedDemo;

/** Mount the controls exactly as PlayScreen does, from a driver. */
function renderFrom(driver: PlateDriver) {
  return render(
    <Controls
      altLabel={driver.altLabel}
      altArmed={driver.armed}
      onDir={driver.press}
      onToggleAlt={driver.toggleArm}
      onUndo={driver.undo}
      guiding={driver.sandbox}
      highlight={driver.highlight}
    />,
  );
}

describe("Controls, driven by a plate driver", () => {
  it("offers corrections on a real plate", () => {
    renderFrom(playingPlate(fakeGame(), LEVEL, null));
    // four arrows plus undo — the reset lives behind a hold and is passed
    // separately by the screen, so it is absent here by construction
    expect(screen.getAllByRole("button").length).toBeGreaterThan(4);
    expect(screen.getByText(/^Z$/)).toBeDefined();
  });

  it("withholds corrections on the sandbox — there is no run to correct", () => {
    renderFrom(guidedPlate(fakeGuided())!);
    expect(screen.queryByText(/^Z$/)).toBeNull();
  });

  it("routes an arrow press back to the session that is driving", () => {
    const game = fakeGame();
    renderFrom(playingPlate(game, LEVEL, null));
    fireEvent.click(screen.getByText("↓"));
    expect(game.play).toHaveBeenCalledWith([1, 0], false);
  });

  it("routes the same press to the tutorial while it holds the table", () => {
    const guided = fakeGuided();
    renderFrom(guidedPlate(guided)!);
    fireEvent.click(screen.getByText("↓"));
    expect(guided.press).toHaveBeenCalledWith([1, 0], false);
  });

  it("shows the alt control only where the state offers the gesture", () => {
    const { unmount } = renderFrom(
      playingPlate(fakeGame({ st: MERGED }), LEVEL, null),
    );
    expect(screen.getByText("⇧")).toBeDefined();
    unmount();
    // the same level, pawns apart: no merge to undo, so no alt gesture at all
    renderFrom(playingPlate(fakeGame({ st: APART }), LEVEL, null));
    expect(screen.queryByText("⇧")).toBeNull();
  });

  it("lights the arm control, not an arrow, while a split hint is unarmed", () => {
    const game = fakeGame({ st: MERGED, hint: { kind: "split", dir: [1, 0] } });
    renderFrom(playingPlate(game, LEVEL, null));
    const armButton = screen.getByText("⇧").closest("button")!;
    const arrow = screen.getByText("↓");
    expect(armButton.className).toContain("sp-guide");
    expect(arrow.className).not.toContain("sp-guide");
  });

  it("moves the light onto the arrow once the state is armed", () => {
    const game = fakeGame({
      st: MERGED,
      altArmed: true,
      hint: { kind: "split", dir: [1, 0] },
    });
    renderFrom(playingPlate(game, LEVEL, null));
    expect(screen.getByText("↓").className).toContain("sp-guide");
  });

  it("lights every arrow on a free tutorial beat", () => {
    renderFrom(
      guidedPlate(
        fakeGuided({ guidance: { arm: false, dir: null, any: true } }),
      )!,
    );
    for (const glyph of ["↑", "↓", "←", "→"])
      expect(screen.getByText(glyph).className).toContain("sp-guide");
  });
});
