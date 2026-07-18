import { describe, expect, it } from "vitest";
import { computeStreaks } from "./streak.ts";

// `computeStreaks(days, today)` reads a set of played UTC days (YYYY-MM-DD, each
// a day the player solved at least one tier) and reports the profile stats:
// total distinct days, the current run, and the longest run ever.
describe("computeStreaks", () => {
  it("is all zeros with no days played", () => {
    expect(computeStreaks([], "2026-07-17")).toEqual({
      total: 0,
      current: 0,
      longest: 0,
    });
  });

  it("counts distinct days for total, ignoring order and duplicates", () => {
    const days = ["2026-07-10", "2026-07-01", "2026-07-10"];
    expect(computeStreaks(days, "2026-07-17").total).toBe(2);
  });

  it("longest is the longest consecutive run, gaps reset it", () => {
    // a 3-run, a gap, then a 2-run
    const days = [
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-05",
      "2026-07-06",
    ];
    expect(computeStreaks(days, "2026-07-17").longest).toBe(3);
  });

  it("longest spans a month boundary", () => {
    const days = ["2026-06-29", "2026-06-30", "2026-07-01"];
    expect(computeStreaks(days, "2026-07-17").longest).toBe(3);
  });

  it("a first day played today reads as a current (and longest) streak of one", () => {
    expect(computeStreaks(["2026-07-17"], "2026-07-17")).toEqual({
      total: 1,
      current: 1,
      longest: 1,
    });
  });

  it("current counts the run ending today", () => {
    const days = ["2026-07-15", "2026-07-16", "2026-07-17"];
    expect(computeStreaks(days, "2026-07-17").current).toBe(3);
  });

  it("current still counts a run ending yesterday (grace before today is over)", () => {
    const days = ["2026-07-15", "2026-07-16"];
    expect(computeStreaks(days, "2026-07-17").current).toBe(2);
  });

  it("current is zero when the last play was before yesterday", () => {
    const days = ["2026-07-10", "2026-07-11"];
    expect(computeStreaks(days, "2026-07-17").current).toBe(0);
  });
});

// getMyStreak unions the *solved puzzle's* date into the played set — never the
// server's current utcDay(). These pin that contract: during the grace window a
// player solves yesterday's puzzle after UTC midnight, and crediting a "today"
// they never played would inflate the run by one.
describe("daily streak union (midnight grace window)", () => {
  it("crediting the solved (yesterday) date does not inflate past the real run", () => {
    const played = ["2026-07-15", "2026-07-16"]; // last real play: yesterday
    const solved = "2026-07-16"; // yesterday's puzzle, solved after UTC midnight
    const today = "2026-07-17";
    expect(computeStreaks([...played, solved], today).current).toBe(2);
    // the previous bug unioned `today`, fabricating an unplayed day → +1
    expect(computeStreaks([...played, today], today).current).toBe(3);
  });

  it("crediting today's own solve extends the run before the submit lands", () => {
    const played = ["2026-07-16"]; // yesterday committed; today's submit racing
    expect(
      computeStreaks([...played, "2026-07-17"], "2026-07-17").current,
    ).toBe(2);
  });
});
