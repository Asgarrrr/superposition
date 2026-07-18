// Pins the verb → sensory-signature contract shared by the game and its
// tutorial: which sound and which vibration a state transition earns, and the
// priority order (a refusal beats everything; a merge beats the gesture that
// caused it; the gesture kind beats the ice ambience).

import { describe, expect, it } from "vitest";
import type { GameState, Level } from "../engine/types.ts";
import { inputSignature } from "./signatures.ts";

const level = (mods: Level["mods"] = []): Level => ({
  id: "t",
  ch: "t",
  name: "t",
  size: 4,
  mods,
  a: { start: [0, 0], goal: [3, 3], walls: [] },
  b: { start: [1, 1], goal: [2, 2], walls: [] },
});

const apart: GameState = { merged: false, a: [0, 0], b: [1, 1], off: [0, 0] };
const together: GameState = { merged: true, m: [1, 1], off: [0, 0] };
const moved: GameState = { merged: false, a: [0, 1], b: [1, 2], off: [0, 0] };

describe("inputSignature", () => {
  it("refus moteur → block + recul bref, quel que soit le geste", () => {
    for (const kind of ["move", "split", "shift"] as const)
      expect(inputSignature(apart, null, kind, level())).toEqual({
        fx: "block",
        vibrate: 25,
      });
  });

  it("transition vers fusionné → merge", () => {
    expect(inputSignature(apart, together, "move", level())).toEqual({
      fx: "merge",
      vibrate: [10, 20, 40],
    });
  });

  it("un décalage qui fusionne joue merge, pas shift", () => {
    expect(inputSignature(apart, together, "shift", level()).fx).toBe("merge");
  });

  it("rester fusionné n'est pas une fusion : le geste garde sa voix", () => {
    expect(inputSignature(together, together, "move", level()).fx).toBe("move");
  });

  it("shift → rumble long", () => {
    expect(inputSignature(apart, moved, "shift", level())).toEqual({
      fx: "shift",
      vibrate: 40,
    });
  });

  it("split → motif divergent, même sur glace", () => {
    const sig = { fx: "split", vibrate: [15, 30, 15] };
    expect(inputSignature(together, apart, "split", level())).toEqual(sig);
    expect(inputSignature(together, apart, "split", level(["glace"]))).toEqual(
      sig,
    );
  });

  it("poussée sur glace → slide, sans haptique", () => {
    expect(inputSignature(apart, moved, "move", level(["glace"]))).toEqual({
      fx: "slide",
      vibrate: null,
    });
  });

  it("poussée simple → move, sans haptique", () => {
    expect(inputSignature(apart, moved, "move", level())).toEqual({
      fx: "move",
      vibrate: null,
    });
  });
});
