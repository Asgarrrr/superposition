import { describe, expect, it } from "vitest";
import type { Level } from "../engine/types.ts";
import { buildDailyShare, shareGrid } from "./dailyShare.ts";

const base: Level = {
  id: "t",
  ch: "I",
  name: "T",
  size: 3,
  mods: [],
  a: { start: [2, 0], goal: [0, 0], walls: [[1, 1]] },
  b: { start: [2, 2], goal: [0, 2], walls: [] },
};

describe("shareGrid", () => {
  it("marks the two ink goals, walls and empty cells", () => {
    expect(shareGrid(base)).toBe("🟦⬛🟪\n⬛🟫⬛\n⬛⬛⬛");
  });

  it("renders coinciding goals as a single fused white cell", () => {
    const fused: Level = { ...base, b: { ...base.b, goal: [0, 0] } };
    expect(shareGrid(fused)).toBe("⬜⬛⬛\n⬛🟫⬛\n⬛⬛⬛");
  });
});

describe("buildDailyShare", () => {
  it("assembles header, moves line, grid and url", () => {
    const block = buildDailyShare({
      level: base,
      date: "2026-07-18",
      tier: 1,
      moves: 7,
      optimal: 6,
      url: "https://example.test/daily/1",
    });
    const lines = block.split("\n");
    expect(lines[0]).toContain("2026-07-18");
    expect(lines[0]).toContain("II"); // palier / tier II (tier index 1 → roman)
    expect(lines[1]).toContain("7");
    expect(lines[1]).toContain("6");
    expect(lines.slice(2, 5).join("\n")).toBe(shareGrid(base));
    expect(lines.at(-1)).toBe("https://example.test/daily/1");
  });

  it("drops the optimal clause when it is unknown", () => {
    const block = buildDailyShare({
      level: base,
      date: "2026-07-18",
      tier: 0,
      moves: 4,
      optimal: 0,
      url: "u",
    });
    expect(block.split("\n")[1]).not.toContain("optimal");
  });
});
