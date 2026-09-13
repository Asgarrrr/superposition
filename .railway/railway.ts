// Railway Infrastructure-as-Code — the whole topology in one file.
//   railway config plan   # preview
//   railway config apply  # apply
// This is the single source of truth for the project's services; there is no
// railway.json (it was migrated here to avoid dual ownership).

import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
} from "railway/iac";

const REPO = "Asgarrrr/superposition";

export default defineRailway(() => {
  const Postgres = postgres("Postgres");

  // Web service: Nitro server (bun preset). Migrates on deploy, serves the SPA,
  // server functions, and the Better Auth handler.
  const web = service("web", {
    source: github(REPO),
    build: "bun run build",
    start: "bun run start",
    preDeployCommand: ["bun run db:migrate"],
    // `/` is the SPA shell: it answers 200 with the database on the floor.
    // /api/health runs `select 1` first.
    healthcheckPath: "/api/health",
    env: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
      // secrets set out-of-band (dashboard / CLI) — keep their remote values
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
    },
  });

  // Cron service: same repo, skips the vite build, runs the daily generator on a
  // schedule, then exits (restart NEVER — it's a one-shot per run).
  const cron = service("cron", {
    source: github(REPO),
    // Skips the vite build (this service serves nothing), but still typechecks
    // what it actually runs: the root tsconfig EXCLUDES src/solver, so the web
    // build's `tsc --noEmit` never sees generate-daily.ts. Without this line the
    // cron ships code no compiler has read.
    build: "bun install && bun run typecheck:solver",
    start: "bun run gen:daily",
    deploy: {
      cronSchedule: "0 5 * * *",
      restartPolicyType: "NEVER",
    },
    // NOTE: this service has a generated public domain
    // (cron-production-ad37.up.railway.app) that serves nothing — a process
    // which exits has no port to expose. It is NOT removable from here: both
    // `serviceDomains: { "<host>": null }` and `serviceDomains: null` plan as
    // no-ops in railway 3.5.7. Delete it from the dashboard.
    env: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
    },
  });

  return project("superposition", {
    resources: [web, Postgres, cron],
  });
});
