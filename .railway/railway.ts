// EXPERIMENTAL — Railway Infrastructure-as-Code (TypeScript DSL).
//
// Declares the whole topology (web + cron + Postgres) in one file. This is the
// newer Railway IaC path; it needs the Railway toolchain to apply and is NOT
// part of the app build (excluded from tsconfig — `railway/iac` resolves only
// in Railway's environment). The stable, fully-working deploy path is
// railway.json (web service) + the cron service documented in AGENTS.md.
//
// Flagged unknowns (verify against Railway's IaC reference before relying on
// this file): the cron *schedule* field name/shape is undocumented, and secret
// values (BETTER_AUTH_SECRET / BETTER_AUTH_URL) must be set in the dashboard —
// don't commit them here.

import { defineRailway, postgres, project, service } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("postgres");

  // Web service: Railpack build (bun), Nitro server output. Serves the SPA,
  // server functions, and the Better Auth handler.
  const web = service("web", {
    build: "bun run build",
    start: "bun run start",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      // BETTER_AUTH_SECRET / BETTER_AUTH_URL: set as service variables (secrets)
      // in the Railway dashboard — do not hard-code here.
    },
  });

  // Cron service: same repo, skips the vite build (only needs the solver), runs
  // the daily generator, then exits (the process MUST close the pool + exit).
  const cron = service("cron", {
    build: "bun install",
    start: "bun run gen:daily",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
    },
    // TODO(verify): the IaC DSL's cron-schedule field is not documented. Target
    // is "0 5 * * *" (UTC). Until confirmed, set the schedule on the cron
    // service in the Railway dashboard.
  });

  return project("superposition", { resources: [web, db, cron] });
});
