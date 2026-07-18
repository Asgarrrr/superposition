import { describe, expect, it } from "vitest";
import { isValidDay } from "./day.ts";

// `isValidDay(date)` accepts only real UTC calendar days in YYYY-MM-DD form.
// It backstops the daily/replay endpoints: a shape-only check waves through
// impossible dates that then crash Date.parse downstream into a public 500.
describe("isValidDay", () => {
  it("rejects shape-valid but non-calendar dates", () => {
    expect(isValidDay("2020-13-45")).toBe(false); // month 13, day 45
    expect(isValidDay("2024-02-31")).toBe(false); // Feb never has 31
    expect(isValidDay("0000-00-00")).toBe(false); // month 0, day 0
    expect(isValidDay("2023-02-29")).toBe(false); // 2023 is not a leap year
  });

  it("accepts real calendar days, including a leap day", () => {
    expect(isValidDay("2024-02-29")).toBe(true); // 2024 is a leap year
    expect(isValidDay("2026-07-18")).toBe(true);
    expect(isValidDay("1999-12-31")).toBe(true);
  });

  it("rejects anything that isn't the exact YYYY-MM-DD shape", () => {
    expect(isValidDay("2024-2-9")).toBe(false);
    expect(isValidDay("2024-02-29T00:00:00Z")).toBe(false);
    expect(isValidDay("abcd-ef-gh")).toBe(false);
    expect(isValidDay("")).toBe(false);
  });
});
