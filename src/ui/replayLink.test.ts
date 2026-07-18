import { describe, expect, it, vi } from "vitest";
import type { TraceStep } from "../engine/types.ts";
import { MAX_REPLAY_STEPS } from "../lib/replayTrace.ts";
import { campaignReplayUrl, dailyReplayUrl } from "./replayLink.ts";

vi.stubGlobal("window", { location: { origin: "https://sp.test" } });

// A clean line of N moves: winningLine leaves it untouched, so length is N.
const moves = (n: number): TraceStep[] =>
  Array.from({ length: n }, () => ({ kind: "move", dir: [0, 1] }));

describe("replay URL helpers — replay-endpoint cap", () => {
  it("builds a URL from the level's stable id at the max step count", () => {
    const url = campaignReplayUrl("accord", moves(MAX_REPLAY_STEPS));
    expect(url).toMatch(
      /^https:\/\/sp\.test\/api\/replay\/c\/accord\/[a-l]+\.gif$/,
    );
  });

  it("returns null one step over the max", () => {
    expect(campaignReplayUrl("accord", moves(MAX_REPLAY_STEPS + 1))).toBeNull();
    expect(
      dailyReplayUrl("2026-01-01", 0, moves(MAX_REPLAY_STEPS + 1)),
    ).toBeNull();
  });
});
