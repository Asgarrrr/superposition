// Which criteria are live on each board. The rule itself is pinned in
// ranking.test.ts; what is pinned HERE is the setting — the daily's discovery
// time is measured, stored and shown, but does not yet order anything.
//
// When TIME_RANKS is flipped on, this file is the test that fails, which is the
// point: enabling a ranking criterion should be a deliberate edit with a visible
// diff, never something that drifts in with an unrelated change.

import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { dailyScore, levelScore } from "../db/schema.ts";
import { liveCriteria, rankingOrder } from "./ranking.ts";

const order = (cols: Parameters<typeof rankingOrder>[0]) =>
  rankingOrder(cols).map((s) => new PgDialect().sqlToQuery(s).sql);

describe("live ranking criteria", () => {
  it("does not order the daily on discovery time yet", () => {
    expect(order(liveCriteria(dailyScore))).toEqual([
      '"daily_score"."moves" asc',
      '"daily_score"."undos" asc',
      '"daily_score"."created_at" asc',
    ]);
  });

  it("keeps the daily's own column out of the rule while it is unranked", () => {
    // the column exists and is being filled; it simply is not a criterion
    expect(liveCriteria(dailyScore).elapsedMs).toBeUndefined();
    expect(dailyScore.elapsedMs).toBeDefined();
  });

  it("orders the campaign exactly as it always did", () => {
    expect(order(liveCriteria(levelScore))).toEqual([
      '"level_score"."moves" asc',
      '"level_score"."undos" asc',
      '"level_score"."created_at" asc',
    ]);
  });
});
