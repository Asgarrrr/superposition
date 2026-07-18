// Pins the alt-gesture rule: which secondary gesture a state offers, and that
// merged wins over the decalage world gesture (a split is the only way out).

import { describe, expect, it } from "vitest";
import type { GameState, Level } from "../engine/types.ts";
import { altGesture, isAltKind } from "./altGesture.ts";

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

describe("altGesture", () => {
  it("sans mod et non fusionné → aucun geste alternatif", () => {
    expect(altGesture(apart, level())).toBeNull();
  });

  it("fusionné → split", () => {
    expect(altGesture(together, level())).toBe("split");
  });

  it("décalage non fusionné → shift", () => {
    expect(altGesture(apart, level(["decalage"]))).toBe("shift");
  });

  it("fusionné sur un niveau décalage → split gagne", () => {
    expect(altGesture(together, level(["decalage"]))).toBe("split");
  });
});

describe("isAltKind", () => {
  it("split et shift demandent l'armement, move non", () => {
    expect(isAltKind("split")).toBe(true);
    expect(isAltKind("shift")).toBe(true);
    expect(isAltKind("move")).toBe(false);
  });
});
