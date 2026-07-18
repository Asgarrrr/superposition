<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `bunx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## Project context

**Superposition** — a two-layer puzzle game (two pawns, one input), art
direction "table lumineuse" (screen-printing workshop). Originally a plain
Vite + React SPA; the game engine/UI/solver were **ported onto a TanStack
Start base** (this repo). The game itself is unchanged; only the shell,
routing, and build were migrated.

### How this repo was created

1. Scaffolded a blank TanStack Start (React) app with the TanStack CLI, run in
   a scratch directory (`--package-manager bun` substituted for the requested
   `pnpm` — this workspace uses **bun**):

   ```
   npx @tanstack/cli@latest create my-tanstack-app --agent --package-manager bun --tailwind
   ```

   Notes: `--tailwind` is deprecated/ignored (Tailwind is always on in Start
   scaffolds). The CLI's own post-step `bunx --bun @tanstack/intent install --map`
   failed and was re-run manually.

2. TanStack Intent wiring:

   ```
   npx @tanstack/intent@latest install   # created the intent-skills block above
   npx @tanstack/intent@latest list      # enumerates local skills to load before edits
   ```

   Skills loaded before the port: `start-core/execution-model`,
   `start-core/deployment` (client-only rendering + SPA decision).

3. Ported the game from the old Vite app into this base: `src/engine`,
   `src/solver`, `src/ui`, `src/index.css`, `messages/`, `project.inlang/`,
   `scripts/`, `public/favicon.svg`. Deleted the scaffold demo
   (`Header`/`Footer`/`ThemeToggle`, `routes/about.tsx`, `styles.css`).

### Stack & toolchain

- React 19 + TanStack Start (Vite plugin `tanstackStart()` + Nitro), TanStack
  Router with **file-based routing** (`src/routes/`, generated `routeTree.gen.ts`).
- **Client-only components, `data-only` default**: `src/start.ts` sets
  `defaultSsr: "data-only"` — loaders and route `head` run on the server, but no
  route renders its COMPONENT server-side (the game uses AudioContext,
  localStorage, keyboard/swipe). The default is `data-only` (not `false`) so the
  public profile can emit real per-request `<head>` tags for social crawlers; a
  child route can only be as SSR-permissive as its parents, so the root must
  allow it. Routes whose loader must stay client-side opt back out with
  `ssr: false` (e.g. `daily.$tier` — its board is a live client experience).
- Single route `/` (`src/routes/index.tsx`) mounts the game's `<App />`, whose
  internal screen router owns title / select / play. `__root.tsx` is the HTML
  shell (`lang="fr"`, theme-color `#14110E`, `src/index.css`).
- React Compiler kept, applied via `@rolldown/plugin-babel` +
  `reactCompilerPreset` from `@vitejs/plugin-react` (plugin-react v6 in
  rolldown-vite has **no** `babel` option — do not try `viteReact({ babel })`).
- i18n: Paraglide (`@inlang/paraglide-js`), `paraglideVitePlugin` in
  `vite.config.ts`; `src/paraglide/` is generated (gitignored) by
  `bun run paraglide` / the vite plugin.
- Tailwind CSS 4 (`@tailwindcss/vite`), design tokens in `src/index.css` `@theme`.
- Engine tests: Vitest, `*.test.ts` colocated, engine-only (`vitest.config.ts`).
- Solver CLI: `src/solver/` runs under **bun** with Node types
  (`src/solver/tsconfig.json`); excluded from the app `tsconfig.json`.

### Commands

- `bun run dev` — dev server (port 3000; falls back if busy)
- `bun run build` — `paraglide` compile + `tsc --noEmit` + `vite build`
  (Nitro output → `.output/server/index.mjs` + `.output/public`)
- `bun run start` — run the built Nitro server (`bun .output/server/index.mjs`)
- `bun run test` — Vitest: engine tests + `src/server/replay.test.ts`
- `bun run verify` — solver certifies the 16-level bank (fails if any is unsolvable)
- `bun run gen` — hunt new levels; `bun run gen:hero` — hero image
- `bun run gen:daily` — generate + persist the daily puzzle (today + J+1/J+2), then exit
- `bun run db:generate` / `db:migrate` — Drizzle migrations (needs `DATABASE_URL`)
- `bun run auth:generate` — regenerate the Better Auth tables via the CLI (`bunx`,
  overwrites `src/db/schema.ts` — re-append our tables from git after:
  `dailyPuzzle`, `dailyScore`, `levelScore`)
- `bun run lint` — oxlint
- `bun run generate-routes` — regenerate the route tree (`tsr generate`)

### Environment variables

The pure game needs none, but the daily-level / accounts / leaderboard layer
does. All server-only — **never** prefix with `VITE_` (that inlines into the
browser bundle). Client-exposed vars must be `VITE_`-prefixed; there are none.
Copy `.env.example` → `.env` for local dev (bun auto-loads it); Railway injects
the real values.

- `DATABASE_URL` — Postgres connection. Local dev via `docker-compose.yml`; on
  Railway use `${{Postgres.DATABASE_URL}}` (private host, no SSL).
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
- `BETTER_AUTH_URL` — the app's public origin (also added to `trustedOrigins`).

## Server layer — daily level, accounts, leaderboard

A shared daily puzzle (Wordle-style) with email/password accounts, a per-day
leaderboard, and public player profiles. Components never render server-side
(`defaultSsr: "data-only"`); data flows through server functions + auth/OG API
routes. Profiles: `username` plugin (Better Auth) gives each account a unique
handle; `/profile/me` (private) and `/profile/$username` (public) show a daily
contribution grid + streaks; `/api/og/$username` renders a dynamic Open Graph
PNG (satori + resvg, server-only in `src/server/og/`, kept out of the client
bundle). DB reads for profiles live in `src/server/profileData.ts` — never
import that (or `db`) from a module the client route tree pulls in.

- **DB**: Postgres + Drizzle (`pg` pool). `src/db/index.ts` (pool + client),
  `src/db/schema.ts` (auth tables generated by the Better Auth CLI + our
  `daily_puzzle` / `daily_score`). Migrations in `src/db/migrations/`, config in
  `src/db/drizzle.config.ts`.
- **Auth**: Better Auth, email + password, Drizzle adapter (`provider: "pg"`).
  `src/lib/auth.ts` (server) — `tanstackStartCookies()` MUST be the **last**
  plugin. `src/lib/auth-client.ts` (`better-auth/react`). Mounted at
  `src/routes/api/auth/$.ts` (splat → `auth.handler(request)`).
- **Server functions** (`src/server/daily.ts`): `getDailyPuzzle` (falls back to
  a deterministic pick from `LEVELS` when no row exists), `submitDailyScore`,
  `getDailyLeaderboard`, `getMyDailyResult`. Session is read server-side via
  `auth.api.getSession({ headers })` — enforce auth **inside** each handler.
- **Anti-cheat** (`src/server/replay.ts`): the client submits its winning input
  sequence; the server **replays** it through the pure engine to confirm the win
  and count moves. Never trust the client's score. Two entry points:
  `validateSolution` (daily — a plain winning input list) and `validateTrace`
  (campaign — the full raw trace incl. undo/reset, replayed on a state stack so
  the server derives both the move count and the correction count for the
  clean-solve rank). Tested in `src/server/replay.test.ts`.
- **Generation** (`src/solver/`): `hunt.ts` (extracted from `generate.ts` —
  `randomLevel` + certified search, importable), `generate-daily.ts` (cron CLI:
  hunt today + J+1/J+2, insert, **close the pool and `exit(0)`**).
- **UI**: `/daily` route plays the day's level through `PlayScreen` in daily
  mode. The shared `LeaderboardRail` (bound to the day via `DailyBoard`, to a
  campaign level via `LevelBoard`) reads the board, gates on an account
  (`AuthPanel`), auto-submits the winning trace, and shows the standing;
  `DailyOverlay` is now the daily win celebration only. `useGame` records the
  full trace (inputs + undo/reset) for server-side replay.

### Don't recreate

| Concern                                       | Lives in                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| pg pool + drizzle client                      | `src/db/index.ts`                                                                            |
| DB tables (auth + daily + campaign)           | `src/db/schema.ts`                                                                           |
| Better Auth server / client                   | `src/lib/auth.ts` / `src/lib/auth-client.ts`                                                 |
| auth HTTP mount                               | `src/routes/api/auth/$.ts`                                                                   |
| daily server functions                        | `src/server/daily.ts`                                                                        |
| campaign leaderboard functions                | `src/server/campaign.ts`                                                                     |
| trace replay + shape validation               | `src/server/replay.ts` (`validateTrace`, `validateTraceShape`)                               |
| level generation core                         | `src/solver/hunt.ts`                                                                         |
| daily cron entry                              | `src/solver/generate-daily.ts`                                                               |
| daily win overlay / auth form                 | `src/ui/components/DailyOverlay.tsx` / `AuthPanel.tsx`                                       |
| leaderboard row list                          | `src/ui/components/LeaderboardRows.tsx`                                                      |
| leaderboard rail (shared)                     | `src/ui/components/LeaderboardRail.tsx` (bound by `DailyBoard.tsx` / `LevelBoard.tsx`)       |
| ranking rule (upsert guard + ORDER BY + rank) | `src/server/ranking.ts` — the ONLY place "fewer moves, then fewer corrections" lives         |
| score upsert + board types + currentUserId    | `src/server/leaderboard.ts` (`upsertBestScore`, `LeaderRow`/`MyResult`/`BoardData`)          |
| merge equation (`a == b + off`)               | `merges()` in `src/engine/state.ts` — sole owner, used by successors AND decalage            |
| per-level compiled mechanics                  | `compiled()` in `src/engine/mechanics/registry.ts` (WeakMap; hosts the two-movers throw)     |
| mechanic necessity semantics                  | `removedWith`/`mustBeNeeded` on each mechanic; probe = `isRequired()` in `src/solver/bfs.ts` |
| verb → sound/haptic signature                 | `inputSignature()` in `src/ui/signatures.ts` (game + tutorial both consume it)               |
| alt-gesture rule (split/world)                | `altGesture()` in `src/ui/altGesture.ts`                                                     |
| solve value + submission policy               | `src/ui/submissionPolicy.ts` (`Solve`, `decideSubmission` — pure, owns the UI status)        |

### Deployment

Target: **Railway**, defined as **Infrastructure as Code** in
`.railway/railway.ts` — web service + managed Postgres + cron service, one file,
one source of truth (there is no `railway.json`). Edit it, then
`railway config plan` → `railway config apply`. The `railway` npm package (the
Railway TS SDK) provides `railway/iac` and powers `config plan/apply`; a
project-local `railway-config` skill (`.agents/skills/`) helps edit it safely.

The build uses the **Nitro** server target (`nitro({ preset: "bun" })` in
`vite.config.ts`) — it self-serves the client bundle, reads `PORT`, and emits
`.output/server/index.mjs`. Run with `bun run start`. (The srvx CLI output does
NOT serve the client assets alongside the handler — that's why we use Nitro.)

Topology in `.railway/railway.ts`:

- **web** — `source: github(...)`, build `bun run build`, start `bun run start`,
  `preDeployCommand: bun run db:migrate`, healthcheck `/`. Env: `DATABASE_URL`
  from the Postgres ref; `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` set out of band
  (secrets, `preserve()`d in IaC).
- **Postgres** — `postgres("Postgres")`; other services reference its
  `DATABASE_URL`.
- **cron** — `source: github(...)`, build `bun install` (skips the vite build),
  start `bun run gen:daily`, `deploy.cronSchedule = "0 5 * * *"` (UTC),
  `restartPolicyType: "NEVER"`. The generator closes the pool and `exit(0)` or
  the next run is skipped.

Secrets to set once (dashboard/CLI, not in the file): `BETTER_AUTH_SECRET`
(`openssl rand -base64 32`) and `BETTER_AUTH_URL` (the web service's public
domain).

Runtime network dependency: the Instrument Serif web font (Google Fonts).

### Key decisions & gotchas

- Package manager is **bun**, not the requested pnpm.
- Path aliases `#/*` and `@/*` → `./src/*` exist (scaffold), but game code uses
  explicit relative imports with `.ts`/`.tsx` extensions — keep that convention.
- `tsconfig.json` has `allowJs`/`allowArbitraryExtensions` for the Paraglide
  `.js` output, and excludes `src/solver` + `scripts` (Node/bun context).
- One oxlint warning on `__root.tsx` (`react/only-export-components`) is inherent
  to TanStack file-route modules (they export both `Route` and a component); the
  same warning fires on every route file (`daily.tsx`, etc.).
- `@better-auth/core` must resolve to the **same** version as `better-auth`
  (1.6.23). `@better-auth/cli` lags (1.4.21) and drags an old core, so it's NOT a
  dependency — `auth:generate` runs it via `bunx @better-auth/cli@latest`.
- Nitro bundles better-auth, which optionally `import("@opentelemetry/api")` for
  tracing. Without that package the bundled import mis-resolves and crashes on
  first auth write, so `@opentelemetry/api` is a direct dependency (no-op tracer).

### Next steps

- Optional: split the game's three screens into real routes
  (`/`, `/levels`, `/play/$levelId`) for shareable URLs + back-button. Session
  state (`useSound` AudioContext, `useBestScores`) would lift into `__root`.
  A design for this exists; the current port keeps the in-`App` screen router.
- Old project instructions live in `superposition-old/CLAUDE.md` (engine
  invariants, how to add a mechanic/level) — still authoritative for game rules.
