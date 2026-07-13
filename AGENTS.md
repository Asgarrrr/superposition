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

Blank TanStack Start app (React), scaffolded with the TanStack CLI.

### How this was created

- Scaffold command (run in a scratch dir; `--package-manager bun` substituted
  for the requested `pnpm` because this workspace uses **bun**):

  ```
  npx @tanstack/cli@latest create my-tanstack-app --agent --package-manager bun --tailwind
  ```

  Notes: `--tailwind` is deprecated/ignored (Tailwind is always on in Start
  scaffolds). The CLI's own post-step `bunx --bun @tanstack/intent install --map`
  failed and was re-run manually (below).

- Follow-up TanStack Intent commands:

  ```
  npx @tanstack/intent@latest install   # created the intent-skills block above
  npx @tanstack/intent@latest list      # enumerates local skills to load before edits
  ```

### Stack & toolchain

- React 19 + TanStack Start (SSR framework: Vite plugin `tanstackStart()` + Nitro).
- TanStack Router, file-based routing (`src/routes/`, generated `routeTree.gen.ts`
  via `@tanstack/router-plugin` / `tsr generate`).
- Tailwind CSS 4 (`@tailwindcss/vite`).
- Vitest + Testing Library + jsdom.
- Devtools: `@tanstack/react-devtools` + router devtools panel (dev only).
- `lucide-react` (icons, pulled in by the starter's Header/ThemeToggle).
- Default CLI toolchain kept (no toolchain overrides).

### "Blank" is not empty — what the starter ships

The CLI blank template is not a bare shell. It includes, beyond the framework:
`src/components/{Header,Footer,ThemeToggle}.tsx`, a second route `src/routes/about.tsx`,
a light/dark theme system (inline `THEME_INIT_SCRIPT` in `__root.tsx` + localStorage
`theme` key), and the devtools panel. Remove these if a truly minimal app is wanted.

### Environment variables

- The blank starter requires **no** environment variables to run.
- When you add them: client-exposed vars must be prefixed `VITE_` (inlined into the
  browser bundle); everything else stays server-only via `process.env` and must not
  be referenced in client code. See the `start-core/execution-model` skill.

### Deployment

- Start builds a server (Nitro). `bun run build` then serve the output; deployable to
  Node/Bun, Cloudflare Workers, Netlify, Vercel, Railway. For a client-only target,
  use SPA mode (`ssr: false`) or static prerender. See `start-core/deployment` skill.

### Key decisions & gotchas

- Package manager is **bun**, not the requested pnpm. `package.json` still carries a
  `pnpm.onlyBuiltDependencies` block from the template — harmless under bun, remove if
  it bothers you.
- Path alias: `#/*` → `./src/*` (package.json `imports`), plus `resolve.tsconfigPaths`.
- Dev server runs on port 3000 (`vite dev --port 3000`).
- Root route uses `shellComponent` (full `<html>` document) — this is SSR, not a
  client-only `#root` mount.

### Next steps

- Decide whether this stays standalone or is merged into the host project.
- If merging: reconcile bun lockfiles, Vite/Tailwind/Vitest configs, and TS path
  aliases; carry over `AGENTS.md`, `vite.config.ts`, `tsr.config.json`, `src/router.tsx`,
  `src/routes/`, and the Intent skill wiring.
- Run `npx @tanstack/intent@latest list` and load the matching skill before any
  architectural change.
