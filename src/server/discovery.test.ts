import { describe, expect, it } from "vitest";
import { discoveryTime } from "./discovery.ts";

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
