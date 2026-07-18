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
});

describe("rankingOrder (board ordering)", () => {
  it("orders by moves, then corrections, then submission time — all ascending", () => {
    const parts = rankingOrder(dailyScore).map((s) => render(s).sql);
    expect(parts).toEqual([
      '"daily_score"."moves" asc',
      '"daily_score"."undos" asc',
      '"daily_score"."created_at" asc',
    ]);
  });
});

describe("strictlyAhead (positional rank)", () => {
  it("counts fewer moves, then equal moves with fewer corrections, then earlier equal results", () => {
    const mine = { moves: 10, undos: 2, createdAt: new Date(0) };
    const q = render(strictlyAhead(dailyScore, mine));
    expect(q.sql).toBe(
      '("daily_score"."moves" < $1 or ("daily_score"."moves" = $2 and "daily_score"."undos" < $3) or ("daily_score"."moves" = $4 and "daily_score"."undos" = $5 and "daily_score"."created_at" < $6))',
    );
    // the timestamp param is mapped by the column driver to its ISO string
    expect(q.params).toEqual([10, 10, 2, 10, 2, mine.createdAt.toISOString()]);
  });
});
