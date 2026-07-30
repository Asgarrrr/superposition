import { describe, expect, it } from "vitest";
import {
  claimAnchor,
  discoveryTime,
  shownAnchor,
  type Anchor,
  type AnchorStore,
} from "./discovery.ts";

const at = (ms: number) => new Date(ms);
const certified = (servedAt: number) => ({
  servedAt: at(servedAt),
  certified: true,
});

describe("discoveryTime", () => {
  it("measures the interval between the anchor and the submission", () => {
    expect(discoveryTime(certified(0), at(90_000))).toBe(90_000);
  });

  it("does not cap a long but honest solve — the weekend 6x6 can take hours", () => {
    // an earlier version capped at 30 min, which collapsed real solvers on the
    // hardest tier, exactly where the spread between players says the most
    expect(discoveryTime(certified(0), at(6 * 3_600_000))).toBe(6 * 3_600_000);
  });

  it("does not clock a submission with no anchor — signed-out play", () => {
    expect(discoveryTime(null, at(90_000))).toBeNull();
  });

  it("does not clock an uncertified day — the fallback grid is computable offline", () => {
    const fallback = { servedAt: at(0), certified: false };
    expect(discoveryTime(fallback, at(90_000))).toBeNull();
  });

  it("refuses a negative interval rather than handing out a perfect time", () => {
    expect(discoveryTime(certified(90_000), at(0))).toBeNull();
  });

  it("reports a zero interval as measured, not as unmeasured", () => {
    // 0 and null must not collapse: one is a (suspiciously fast) measurement
    // that still ranks, the other is the absence of one, which ranks last
    expect(discoveryTime(certified(0), at(0))).toBe(0);
  });
});

// The second adapter behind the anchor seam — the one that makes it a real seam
// rather than a hypothetical one. Mirrors the Postgres adapter's contract:
// insertIfAbsent writes only when the slot is empty, and reports what it wrote.
function memoryAnchors(initial: Anchor | null = null): AnchorStore {
  let row = initial;
  return {
    async insertIfAbsent(servedAt, certified) {
      if (row) return null;
      row = { servedAt, certified };
      return row;
    },
    async read() {
      return row;
    },
  };
}

describe("claimAnchor", () => {
  it("anchors the first delivery at the time it was served", async () => {
    const anchor = await claimAnchor(memoryAnchors(), at(1000), true);
    expect(anchor).toEqual({ servedAt: at(1000), certified: true });
  });

  it("hands back the ORIGINAL time on a second delivery", async () => {
    // a reload, a second tab, a second device — none of them may restart the
    // clock, or a player could study the grid and only then start measuring
    const store = memoryAnchors();
    await claimAnchor(store, at(1000), true);
    const again = await claimAnchor(store, at(999_000), true);
    expect(again?.servedAt).toEqual(at(1000));
  });

  it("keeps the STORED certification when the day is certified later", async () => {
    // the cron writes the row after this player was already anchored: the day
    // stays uncertified for them, so the clock they are shown matches the value
    // the server will actually record
    const store = memoryAnchors();
    await claimAnchor(store, at(1000), false);
    const again = await claimAnchor(store, at(2000), true);
    expect(again?.certified).toBe(false);
  });

  it("reads back an anchor written by an earlier session", async () => {
    const store = memoryAnchors({ servedAt: at(500), certified: true });
    const anchor = await claimAnchor(store, at(9000), true);
    expect(anchor?.servedAt).toEqual(at(500));
  });

  it("feeds discoveryTime the anchor it claimed, not the fresh delivery", async () => {
    const store = memoryAnchors();
    await claimAnchor(store, at(0), true);
    const anchor = await claimAnchor(store, at(60_000), true);
    // measured from the ORIGINAL delivery: 90s, not the 30s a restarted clock
    // would have reported
    expect(discoveryTime(anchor, at(90_000))).toBe(90_000);
  });
});

describe("shownAnchor", () => {
  it("shows the anchor of a certified day", () => {
    expect(shownAnchor({ servedAt: at(0), certified: true })).toBe(
      at(0).toISOString(),
    );
  });

  it("shows nothing on an uncertified day — nothing is being measured", () => {
    // the counter must not run beside a board that will rightly record no time
    expect(shownAnchor({ servedAt: at(0), certified: false })).toBeNull();
    expect(discoveryTime({ servedAt: at(0), certified: false }, at(1))).toBeNull();
  });

  it("shows nothing when there is no anchor at all — signed-out play", () => {
    expect(shownAnchor(null)).toBeNull();
  });
});
