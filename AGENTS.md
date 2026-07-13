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
- **Client-only**: SSR disabled app-wide via `src/start.ts`
  (`createStart(() => ({ defaultSsr: false }))`). The game uses AudioContext,
  localStorage, and keyboard/swipe — no server data.
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
  (`tsconfig.solver.json`); excluded from the app `tsconfig.json`.

### Commands

- `bun run dev` — dev server (port 3000; falls back if busy)
- `bun run build` — `paraglide` compile + `tsc --noEmit` + `vite build`
  (emits `dist/client` and `dist/server`)
- `bun run test` — Vitest engine tests
- `bun run verify` — solver certifies the 16-level bank (fails if any is unsolvable)
- `bun run gen` — hunt new levels; `bun run gen:hero` — hero image
- `bun run lint` — oxlint
- `bun run generate-routes` — regenerate the route tree (`tsr generate`)

### Environment variables

- None required to run. If added: client-exposed vars must be prefixed `VITE_`
  (inlined into the browser bundle); server-only secrets stay unprefixed and out
  of client code (see `start-core/execution-model`). This game needs neither.

### Deployment

- `bun run build` produces a client bundle + a Nitro server. Because SSR is off
  app-wide, the game is effectively a static client app; it can be served from
  the Nitro output or made fully static via `tanstackStart({ prerender: { enabled: true } })`
  (see `start-core/deployment`). Only network dependency at runtime: the
  Instrument Serif web font (Google Fonts, `serif` fallback).

### Key decisions & gotchas

- Package manager is **bun**, not the requested pnpm.
- Path aliases `#/*` and `@/*` → `./src/*` exist (scaffold), but game code uses
  explicit relative imports with `.ts`/`.tsx` extensions — keep that convention.
- `tsconfig.json` has `allowJs`/`allowArbitraryExtensions` for the Paraglide
  `.js` output, and excludes `src/solver` + `scripts` (Node/bun context).
- One oxlint warning on `__root.tsx` (`react/only-export-components`) is inherent
  to TanStack file-route modules (they export both `Route` and a component).

### Next steps

- Optional: split the game's three screens into real routes
  (`/`, `/levels`, `/play/$levelId`) for shareable URLs + back-button. Session
  state (`useSound` AudioContext, `useBestScores`) would lift into `__root`.
  A design for this exists; the current port keeps the in-`App` screen router.
- Old project instructions live in `superposition-old/CLAUDE.md` (engine
  invariants, how to add a mechanic/level) — still authoritative for game rules.
