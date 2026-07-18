import { describe, expect, it } from "vitest";
import { frameSvg } from "./board-svg.ts";
import { LEVELS } from "../../engine/levels.ts";
import { initialState } from "../../engine/state.ts";
import type { Level } from "../../engine/types.ts";

const byId = (id: string): Level => {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`missing level ${id}`);
  return level;
};

describe("frameSvg — light walls (lumiere)", () => {
  it("draws one dashed paper marker per light wall", () => {
    const level = byId("eclipse"); // lightWalls: [[1,2],[1,1],[0,1]]
    const svg = frameSvg(level, initialState(level), false);
    const markers = svg.match(/stroke-dasharray="4 4"/g) ?? [];
    expect(markers).toHaveLength(level.lightWalls?.length ?? 0);
    expect(markers.length).toBeGreaterThan(0);
  });

  it("omits light-wall markers on a level without them", () => {
    const level = byId("accord");
    expect(level.lightWalls).toBeUndefined();
    const svg = frameSvg(level, initialState(level), false);
    expect(svg).not.toContain("stroke-dasharray");
  });
});
