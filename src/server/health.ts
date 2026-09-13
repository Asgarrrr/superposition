// Liveness probe for the deployment healthcheck. `/` serves the SPA shell and
// answers 200 with Postgres on the floor, so it says nothing about whether this
// instance can do any work; `select 1` does.
//
// The client is a parameter rather than an import of `db/index.ts` for two
// reasons: that module throws at import time when DATABASE_URL is unset, which
// would make this file untestable in CI (no database there, by design), and a
// probe that cannot be pointed at a failing client cannot be tested failing.
// The route passes the real pool.
//
// The race against a timer lives here rather than on the shared Pool. `pg` has
// no timeout configured, so an unreachable database leaves the connection
// hanging and the healthcheck would stall instead of failing. Putting a
// deadline on every query the server makes is a different change, with
// different blast radius — decide it separately.

/** The one thing a probe needs from a `pg` Pool. Structural, so a test can pass
 *  a hand-written stub and never touch a database. */
export type Queryable = { query(sql: string): Promise<unknown> };

export type Health =
  { ok: true; latencyMs: number } | { ok: false; error: string };

const TIMEOUT_MS = 2_000;

export async function probe(
  client: Queryable,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Health> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // The query keeps running after the timer wins the race. Attaching a handler
  // here — not in the race — marks it handled, so a late rejection does not
  // surface as an unhandled rejection and take the server down.
  const query = client.query("select 1");
  query.catch(() => {});

  try {
    await Promise.race([
      query,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
