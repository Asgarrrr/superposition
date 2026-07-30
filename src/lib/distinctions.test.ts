import { describe, expect, it } from "vitest";
import {
  distinctions,
  THRESHOLDS,
  type DistinctionInput,
} from "./distinctions.ts";

const empty: DistinctionInput = { days: [], bat: [], artist: [], plates: [] };
const of = (patch: Partial<DistinctionInput>): DistinctionInput => ({
  ...empty,
  ...patch,
});
const family = (input: DistinctionInput, key: string) =>
  distinctions(input).find((d) => d.family === key)!;

// A run of `n` consecutive days starting at `from`.
const run = (from: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );

describe("distinctions", () => {
  it("always returns the four families, in a stable order", () => {
    const got = distinctions(empty).map((d) => d.family);
    expect(got).toEqual(["regularite", "maitrise", "rarete", "edition"]);
  });

  it("a blank account earns nothing and is offered the first threshold", () => {
    for (const d of distinctions(empty)) {
      expect(d.tier).toBe(0);
      expect(d.threshold).toBeNull();
      expect(d.earnedOn).toBeNull();
      expect(d.next).toBe(THRESHOLDS[d.family][0]);
    }
  });
});

// Régularité is measured on the LONGEST run, never the current one: a stamp that
// un-sticks because the player skipped a Tuesday is not a proof.
describe("régularité", () => {
  it("does not earn below the first threshold", () => {
    const d = family(of({ days: run("2026-01-01", 6) }), "regularite");
    expect(d.count).toBe(6);
    expect(d.tier).toBe(0);
    expect(d.next).toBe(7);
  });

  it("earns the first tier on the seventh consecutive day", () => {
    const d = family(of({ days: run("2026-01-01", 7) }), "regularite");
    expect(d.tier).toBe(1);
    expect(d.threshold).toBe(7);
    expect(d.earnedOn).toBe("2026-01-07");
    expect(d.next).toBe(30);
  });

  it("takes the longest run, not the most recent one", () => {
    const days = [...run("2026-01-01", 31), ...run("2026-03-01", 8)];
    const d = family(of({ days }), "regularite");
    expect(d.count).toBe(31);
    expect(d.tier).toBe(2);
    expect(d.threshold).toBe(30);
    // the 30th day of the long run, not of the later short one
    expect(d.earnedOn).toBe("2026-01-30");
  });

  it("postmarks the earliest day a run first reached the threshold", () => {
    // two runs clear 30 days; the January one crossed it first, so it postmarks
    const days = [...run("2026-01-01", 30), ...run("2026-06-01", 40)];
    const d = family(of({ days }), "regularite");
    expect(d.count).toBe(40);
    expect(d.tier).toBe(2);
    expect(d.threshold).toBe(30);
    expect(d.earnedOn).toBe("2026-01-30");
  });

  it("the top tier has no next threshold", () => {
    const d = family(of({ days: run("2026-01-01", 365) }), "regularite");
    expect(d.tier).toBe(4);
    expect(d.threshold).toBe(365);
    expect(d.next).toBeNull();
  });

  it("ignores duplicate and unordered days", () => {
    const days = [...run("2026-01-01", 7)].reverse();
    days.push("2026-01-03");
    expect(family(of({ days }), "regularite").count).toBe(7);
  });
});

// The counting families all share one rule: the postmark is the date of the Nth
// qualifying event, where N is the threshold the current tier stands on.
describe("familles à compte", () => {
  it("maîtrise counts bons à tirer and postmarks the Nth", () => {
    const bat = [
      "2026-02-01",
      "2026-02-05",
      "2026-03-09",
      "2026-04-02",
      "2026-04-03",
    ];
    const d = family(of({ bat }), "maitrise");
    expect(d.count).toBe(5);
    expect(d.tier).toBe(1);
    expect(d.threshold).toBe(1);
    expect(d.earnedOn).toBe("2026-02-01"); // the 1st bon à tirer
    expect(d.next).toBe(10);
  });

  it("postmarks the 10th bon à tirer once ten are in", () => {
    const bat = run("2026-02-01", 12); // 12 dates, ascending
    const d = family(of({ bat }), "maitrise");
    expect(d.tier).toBe(2);
    expect(d.earnedOn).toBe("2026-02-10");
  });

  it("sorts the dates before picking the Nth", () => {
    const bat = ["2026-05-01", "2026-01-01", "2026-03-01"];
    const d = family(of({ bat }), "maitrise");
    expect(d.earnedOn).toBe("2026-01-01");
  });

  it("rareté counts épreuves d'artiste", () => {
    const artist = ["2026-01-03", "2026-01-04", "2026-01-10"];
    const d = family(of({ artist }), "rarete");
    expect(d.count).toBe(3);
    expect(d.tier).toBe(1);
    expect(d.next).toBe(5);
  });

  it("édition counts plates and closes at 22", () => {
    const plates = run("2026-01-01", 22);
    const d = family(of({ plates }), "edition");
    expect(d.count).toBe(22);
    expect(d.tier).toBe(4);
    expect(d.threshold).toBe(22);
    expect(d.earnedOn).toBe("2026-01-22");
    expect(d.next).toBeNull();
  });

  it("a count past the top threshold stays at the top tier", () => {
    const artist = run("2026-01-01", 60); // 60 > 52
    const d = family(of({ artist }), "rarete");
    expect(d.count).toBe(60);
    expect(d.tier).toBe(4);
    expect(d.earnedOn).toBe("2026-02-21"); // the 52nd
    expect(d.next).toBeNull();
  });

  it("families do not leak into each other", () => {
    const d = distinctions(of({ bat: ["2026-01-01"] }));
    expect(d.find((x) => x.family === "maitrise")!.tier).toBe(1);
    expect(d.find((x) => x.family === "rarete")!.tier).toBe(0);
    expect(d.find((x) => x.family === "edition")!.tier).toBe(0);
  });
});
