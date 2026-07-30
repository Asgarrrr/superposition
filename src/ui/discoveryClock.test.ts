// The daily clock's reconciliation rules, which used to sit as inline useState
// in the play screen. Collapsing two of these three states was a real bug once:
// on an uncertified day the rail ran a counter for minutes beside a board that
// rightly recorded no time at all.

import { describe, expect, it } from "vitest";
import {
  clockFrozen,
  displayedClock,
  formatClock,
  recordedFrom,
} from "./hooks/useDiscoveryClock.ts";

describe("recordedFrom — the standing's three answers", () => {
  it("reads a measured time as that number", () => {
    expect(recordedFrom({ elapsedMs: 90_000 })).toBe(90_000);
  });

  it("reads a ranked but unmeasured result as null, not as no answer", () => {
    expect(recordedFrom({ elapsedMs: null })).toBeNull();
    // a board that carries no time column at all reads the same way: ranked,
    // nothing measured
    expect(recordedFrom({})).toBeNull();
  });

  it("reads no standing as no answer yet", () => {
    expect(recordedFrom(null)).toBeUndefined();
  });

  it("keeps a zero measurement distinct from an absent one", () => {
    expect(recordedFrom({ elapsedMs: 0 })).toBe(0);
  });
});

describe("displayedClock", () => {
  it("runs the live counter while the board has not answered", () => {
    expect(displayedClock(undefined, 12_000)).toBe(12_000);
  });

  it("shows the recorded value once there is one", () => {
    // never the counter, which on a reload would keep climbing past the value
    // the server actually stored
    expect(displayedClock(90_000, 12_000)).toBe(90_000);
  });

  it("shows nothing for a ranked but unmeasured result", () => {
    expect(displayedClock(null, 12_000)).toBeNull();
  });
});

describe("clockFrozen", () => {
  it("keeps running while unsolved and unanswered", () => {
    expect(clockFrozen(false, undefined)).toBe(false);
  });

  it("stops at the win — that is where the measurement ends", () => {
    expect(clockFrozen(true, undefined)).toBe(true);
  });

  it("stops once the board has answered, measured or not", () => {
    expect(clockFrozen(false, 90_000)).toBe(true);
    expect(clockFrozen(false, null)).toBe(true);
  });
});

describe("formatClock", () => {
  it("reads m:ss under the hour", () => {
    expect(formatClock(95_000)).toBe("1:35");
    expect(formatClock(0)).toBe("0:00");
  });

  it("grows an hour field past the hour — the weekend 6×6 can take hours", () => {
    expect(formatClock(3_600_000)).toBe("1:00:00");
    expect(formatClock(2 * 3_600_000 + 5 * 60_000 + 9_000)).toBe("2:05:09");
  });
});
