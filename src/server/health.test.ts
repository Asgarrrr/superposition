import { describe, expect, it } from "vitest";
import { probe, type Queryable } from "./health.ts";

/** A client whose single query settles however the test says. */
function client(behaviour: Promise<unknown>): Queryable {
  return { query: () => behaviour };
}

describe("probe", () => {
  it("reports ok, with a latency, when the query answers", async () => {
    const health = await probe(
      client(Promise.resolve({ rows: [{ "?column?": 1 }] })),
    );
    expect(health.ok).toBe(true);
    if (health.ok) expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports the failure instead of throwing when the query rejects", async () => {
    const health = await probe(
      client(Promise.reject(new Error("ECONNREFUSED"))),
    );
    expect(health).toEqual({ ok: false, error: "ECONNREFUSED" });
  });

  // the case the healthcheck exists for: `pg` has no timeout, so an unreachable
  // database hangs rather than errors, and a probe without a deadline hangs with it
  it("gives up on a hanging query instead of waiting for it", async () => {
    const health = await probe(client(new Promise(() => {})), 20);
    expect(health.ok).toBe(false);
    if (!health.ok) expect(health.error).toContain("timed out");
  });

  // a query that rejects after losing the race must not escape as an unhandled
  // rejection — that would crash the server the healthcheck is meant to watch
  it("swallows a rejection that arrives after the deadline", async () => {
    const late = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("too late")), 40),
    );
    const health = await probe(client(late), 10);
    expect(health.ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
});
