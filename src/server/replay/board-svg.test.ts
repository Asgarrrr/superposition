import { describe, expect, it } from "vitest";
import { frameSvg, PALETTE_HEX } from "./board-svg.ts";
import { LEVELS } from "../../engine/levels.ts";
import { initialState } from "../../engine/state.ts";
import { CELL, PAD } from "../../ui/components/board-metrics.ts";
import type { Level, Pos } from "../../engine/types.ts";

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

describe("frameSvg — drifting magenta grid", () => {
  const level = byId("derive");
  const CYAN_DIM = PALETTE_HEX[4];
  const MAGENTA_DIM = PALETTE_HEX[5];
  // grid groups are the only ones drawn with stroke-width="1"
  const gridCount = (svg: string) =>
    (svg.match(/stroke-width="1"/g) ?? []).length;

  it("draws a second, magenta grid shifted by the world offset and clipped to the box", () => {
    const svg = frameSvg(
      level,
      { ...initialState(level), off: [0, 1] as Pos },
      false,
    );
    expect(gridCount(svg)).toBe(2);
    // cyan grid stays in board coordinates
    expect(svg).toContain(
      `<g stroke="${CYAN_DIM}" stroke-width="1"><line x1="${PAD}"`,
    );
    // magenta grid is translated one cell right, under the box clip
    expect(svg).toContain(
      `<g clip-path="url(#box)"><g stroke="${MAGENTA_DIM}" stroke-width="1"><line x1="${PAD + CELL}"`,
    );
  });

  it("keeps both grids aligned when the worlds are not drifted", () => {
    const svg = frameSvg(level, initialState(level), false);
    expect(gridCount(svg)).toBe(2);
    expect(svg).toContain(
      `<g stroke="${CYAN_DIM}" stroke-width="1"><line x1="${PAD}"`,
    );
    expect(svg).toContain(
      `<g stroke="${MAGENTA_DIM}" stroke-width="1"><line x1="${PAD}"`,
    );
  });
});
