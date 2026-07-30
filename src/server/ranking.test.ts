// The ranking rule, rendered to SQL without a database: PgDialect turns the
// builders into parameterized text, so the tie-break semantics (fewer moves,
// then fewer corrections, then earliest) are pinned here in CI.

import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { dailyScore, levelScore } from "../db/schema.ts";
import { beatenBy, rankingOrder, strictlyAhead } from "./ranking.ts";

const render = (q: SQL) => new PgDialect().sqlToQuery(q);

describe("beatenBy (upsert guard)", () => {
  it("replaces the stored row only on fewer moves, or equal moves with fewer corrections", () => {
    const q = render(beatenBy(dailyScore, { moves: 12, corrections: 3 }));
    expect(q.sql).toBe(
      '("daily_score"."moves" > $1 or ("daily_score"."moves" = $2 and "daily_score"."undos" > $3))',
    );
    expect(q.params).toEqual([12, 12, 3]);
  });

  it("applies the same rule to the campaign table", () => {
    const q = render(beatenBy(levelScore, { moves: 5, corrections: 0 }));
    expect(q.sql).toBe(
      '("level_score"."moves" > $1 or ("level_score"."moves" = $2 and "level_score"."undos" > $3))',
    );
    expect(q.params).toEqual([5, 5, 0]);
  });

  it("also replaces an identical result reached in more time, or never measured", () => {
    // the IS NULL arm matters: a stored row we could not clock must lose to one
    // we could, or a player would be stuck behind their own unmeasured attempt
    const q = render(
      beatenBy(dailyScore, { moves: 12, corrections: 3, elapsedMs: 45_000 }),
    );
    expect(q.sql).toBe(
      '("daily_score"."moves" > $1 or ("daily_score"."moves" = $2 and "daily_score"."undos" > $3) or ("daily_score"."moves" = $4 and "daily_score"."undos" = $5 and ("daily_score"."elapsed_ms" is null or "daily_score"."elapsed_ms" > $6)))',
    );
    expect(q.params).toEqual([12, 12, 3, 12, 3, 45_000]);
  });

  it("never replaces a stored row on an unmeasured candidate", () => {
    // nothing sorts behind an unmeasured result, so it cannot win this clause
    const q = render(
      beatenBy(dailyScore, { moves: 12, corrections: 3, elapsedMs: null }),
    );
    expect(q.sql).toBe(
      '("daily_score"."moves" > $1 or ("daily_score"."moves" = $2 and "daily_score"."undos" > $3))',
    );
    expect(q.params).toEqual([12, 12, 3]);
  });

  it("ignores the time criterion on a table that has no such column", () => {
    // the campaign never passes a time; even if it did, level_score has no
    // column to compare against and the guard must stay exactly as it was
    const q = render(
      beatenBy(levelScore, { moves: 5, corrections: 0, elapsedMs: 1_000 }),
    );
    expect(q.sql).toBe(
      '("level_score"."moves" > $1 or ("level_score"."moves" = $2 and "level_score"."undos" > $3))',
    );
    expect(q.params).toEqual([5, 5, 0]);
  });
});

describe("rankingOrder (board ordering)", () => {
  it("orders the daily by moves, corrections, discovery time, then submission", () => {
    const parts = rankingOrder(dailyScore).map((s) => render(s).sql);
    expect(parts).toEqual([
      '"daily_score"."moves" asc',
      '"daily_score"."undos" asc',
      '"daily_score"."elapsed_ms" asc nulls last',
      '"daily_score"."created_at" asc',
    ]);
  });

  it("leaves the campaign board exactly as it was", () => {
    const parts = rankingOrder(levelScore).map((s) => render(s).sql);
    expect(parts).toEqual([
      '"level_score"."moves" asc',
      '"level_score"."undos" asc',
      '"level_score"."created_at" asc',
    ]);
  });
});

describe("strictlyAhead (positional rank)", () => {
  it("counts fewer moves, then equal moves with fewer corrections, then earlier equal results", () => {
    const mine = { moves: 10, undos: 2, createdAt: new Date(0) };
    const q = render(strictlyAhead(levelScore, mine));
    expect(q.sql).toBe(
      '("level_score"."moves" < $1 or ("level_score"."moves" = $2 and "level_score"."undos" < $3) or ("level_score"."moves" = $4 and "level_score"."undos" = $5 and "level_score"."created_at" < $6))',
    );
    // the timestamp param is mapped by the column driver to its ISO string
    expect(q.params).toEqual([10, 10, 2, 10, 2, mine.createdAt.toISOString()]);
  });

  it("places an unmeasured result behind every measured one, tied with the others", () => {
    // mine is unmeasured: every measured row is ahead, and only the other
    // unmeasured rows tie — which plain SQL equality would never report
    const mine = {
      moves: 10,
      undos: 2,
      elapsedMs: null,
      createdAt: new Date(0),
    };
    const q = render(strictlyAhead(dailyScore, mine));
    expect(q.sql).toBe(
      '("daily_score"."moves" < $1 or ("daily_score"."moves" = $2 and "daily_score"."undos" < $3) or ("daily_score"."moves" = $4 and "daily_score"."undos" = $5 and "daily_score"."elapsed_ms" is not null) or ("daily_score"."moves" = $6 and "daily_score"."undos" = $7 and "daily_score"."elapsed_ms" is null and "daily_score"."created_at" < $8))',
    );
    expect(q.params).toEqual([10, 10, 2, 10, 2, 10, 2, mine.createdAt.toISOString()]);
  });

  it("inserts the time criterion, and carries its equality into the submission clause", () => {
    // without the added eq(elapsed_ms) the count would disagree with
    // rankingOrder, and a player's rank would not match their row's position
    const mine = {
      moves: 10,
      undos: 2,
      elapsedMs: 45_000,
      createdAt: new Date(0),
    };
    const q = render(strictlyAhead(dailyScore, mine));
    expect(q.sql).toBe(
      '("daily_score"."moves" < $1 or ("daily_score"."moves" = $2 and "daily_score"."undos" < $3) or ("daily_score"."moves" = $4 and "daily_score"."undos" = $5 and "daily_score"."elapsed_ms" < $6) or ("daily_score"."moves" = $7 and "daily_score"."undos" = $8 and "daily_score"."elapsed_ms" = $9 and "daily_score"."created_at" < $10))',
    );
    expect(q.params).toEqual([
      10,
      10,
      2,
      10,
      2,
      45_000,
      10,
      2,
      45_000,
      mine.createdAt.toISOString(),
    ]);
  });
});
