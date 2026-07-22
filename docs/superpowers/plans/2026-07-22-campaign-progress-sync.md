# Campaign Progress Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile a signed-in player's campaign progression between `localStorage` and the `levelScore` table at login, so completed levels follow them across devices.

**Architecture:** `localStorage` (`useBestScores`) stays the source of truth for the anonymous/offline player. A pure planner (`progressSync.ts`) computes what to pull down (server best → local `best`, taking the min) and what to push up (better local clean traces → `submitLevelScore`). A hook (`useProgressSync`) runs the plan once per authenticated session on the selector route, where the session and `useBestScores` are already read. To push traces up, `useBestScores` now persists the winning trace of each level's best clean solve.

**Tech Stack:** React, TanStack Start server functions, Drizzle (Postgres), Better Auth, Vitest.

---

## File structure

- `src/ui/progressSync.ts` (new) — pure planner: `planProgressSync(best, traces, server) → { downloads, uploads }`. No React, no I/O. Testable.
- `src/ui/progressSync.test.ts` (new) — unit tests for the planner.
- `src/ui/hooks/useBestScores.ts` (modify) — persist a `traces` map; `record` gains an optional `trace` argument; expose `traces`.
- `src/ui/hooks/useGame.ts` (modify) — `onWin` passes the winning trace alongside the move count.
- `src/ui/screens/PlayScreen.tsx` (modify) — widen the `onWin` prop type.
- `src/routes/level.$plate.tsx` (modify) — forward the trace into `record`.
- `src/server/campaign.ts` (modify) — new read-only server function `getMyLevelScores`.
- `src/ui/hooks/useProgressSync.ts` (new) — runs the planner once per authenticated session.
- `src/routes/levels.tsx` (modify) — mount `useProgressSync`.

---

## Task 1: Pure sync planner

**Files:**

- Create: `src/ui/progressSync.ts`
- Test: `src/ui/progressSync.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/progressSync.test.ts
import { describe, expect, it } from "vitest";
import { planProgressSync } from "./progressSync.ts";
import type { TraceStep } from "../engine/types.ts";

const T = (n: number): TraceStep[] =>
  Array.from({ length: n }, () => ({ kind: "move", dir: [0, 1] }) as TraceStep);

describe("planProgressSync", () => {
  it("downloads a server level the player has never solved locally", () => {
    const plan = planProgressSync({}, {}, [{ levelId: "a", moves: 7 }]);
    expect(plan.downloads).toEqual([{ levelId: "a", moves: 7 }]);
    expect(plan.uploads).toEqual([]);
  });

  it("downloads only when the server score is strictly better (min per level)", () => {
    const server = [
      { levelId: "a", moves: 5 }, // better than local 8 → pull
      { levelId: "b", moves: 9 }, // worse than local 4 → skip
      { levelId: "c", moves: 6 }, // equal to local 6 → skip
    ];
    const plan = planProgressSync(
      { a: 8, b: 4, c: 6 },
      { b: T(4) }, // b has a trace, but download side ignores traces
      server,
    );
    expect(plan.downloads).toEqual([{ levelId: "a", moves: 5 }]);
  });

  it("uploads a clean local record absent from the server", () => {
    const plan = planProgressSync({ a: 4 }, { a: T(4) }, []);
    expect(plan.uploads).toEqual([{ levelId: "a", trace: T(4) }]);
  });

  it("uploads a clean local record strictly better than the server's", () => {
    const plan = planProgressSync({ a: 3 }, { a: T(3) }, [
      { levelId: "a", moves: 5 },
    ]);
    expect(plan.uploads).toEqual([{ levelId: "a", trace: T(3) }]);
  });

  it("does not upload a level with no stored trace (hinted / traceless)", () => {
    const plan = planProgressSync({ a: 4 }, {}, []);
    expect(plan.uploads).toEqual([]);
  });

  it("does not upload when the server is equal or better", () => {
    const plan = planProgressSync({ a: 5 }, { a: T(5) }, [
      { levelId: "a", moves: 5 },
    ]);
    expect(plan.uploads).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/ui/progressSync.test.ts`
Expected: FAIL — `Failed to resolve import "./progressSync.ts"` / `planProgressSync is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/progressSync.ts
// Pure reconciliation of local progression (localStorage) with the server's
// levelScore rows. No React, no I/O — the hook that runs it is the only impure
// part. Downward: pull a server best that beats (or fills) the local best.
// Upward: push a clean local record (one with a stored trace) that beats (or
// is absent from) the server, replayed through the validated submit path.

import type { TraceStep } from "../engine/types.ts";

export interface ServerScore {
  levelId: string;
  moves: number;
}

export interface SyncPlan {
  downloads: ServerScore[]; // fed to useBestScores.record (which re-applies min)
  uploads: { levelId: string; trace: TraceStep[] }[]; // fed to submitLevelScore
}

export function planProgressSync(
  best: Record<string, number>,
  traces: Record<string, TraceStep[]>,
  server: ServerScore[],
): SyncPlan {
  const serverBy = new Map(server.map((s) => [s.levelId, s.moves]));

  const downloads = server.filter((s) => {
    const local = best[s.levelId];
    return local === undefined || s.moves < local;
  });

  const uploads: SyncPlan["uploads"] = [];
  for (const [levelId, trace] of Object.entries(traces)) {
    const local = best[levelId];
    if (local === undefined) continue; // a trace with no recorded best: ignore
    const remote = serverBy.get(levelId);
    if (remote === undefined || local < remote)
      uploads.push({ levelId, trace });
  }

  return { downloads, uploads };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/ui/progressSync.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/progressSync.ts src/ui/progressSync.test.ts
git commit -m "feat(sync): pure planner reconciling local progression with server scores"
```

---

## Task 2: Persist the winning trace in useBestScores

**Files:**

- Modify: `src/ui/hooks/useBestScores.ts`

- [ ] **Step 1: Add the traces key, widen `record`, expose `traces`**

Replace the whole file with:

```ts
// Best scores per level (key = level id), persisted in localStorage.
// `hinted` marks levels cleared with a hint (off the record: no move count),
// so the selector can show they were solved without pretending to a record.
// `traces` keeps the winning trace of each level's best CLEAN solve, so a
// signed-in player can replay-submit it (see progressSync / useProgressSync).

import { useEffect, useState } from "react";
import type { TraceStep } from "../../engine/types.ts";

const STORAGE_KEY = "superposition.best";
const HINTED_KEY = "superposition.hinted";
const TRACES_KEY = "superposition.traces";

function load<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

export function useBestScores() {
  const [best, setBest] = useState<Record<string, number>>(() =>
    load<number>(STORAGE_KEY),
  );
  const [hinted, setHinted] = useState<Record<string, true>>(() =>
    load<true>(HINTED_KEY),
  );
  const [traces, setTraces] = useState<Record<string, TraceStep[]>>(() =>
    load<TraceStep[]>(TRACES_KEY),
  );

  // persistence lives outside the updater: it must stay pure
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  }, [best]);
  useEffect(() => {
    localStorage.setItem(HINTED_KEY, JSON.stringify(hinted));
  }, [hinted]);
  useEffect(() => {
    localStorage.setItem(TRACES_KEY, JSON.stringify(traces));
  }, [traces]);

  // A clean win passes its trace; a downward sync (record from the server) omits
  // it. The trace is kept only when this solve becomes the new best, mirroring
  // the move-count guard, so a worse replay never overwrites the better line.
  const record = (id: string, moves: number, trace?: TraceStep[]) => {
    setBest((b) => {
      const v = Math.min(b[id] ?? Infinity, moves);
      return v === b[id] ? b : { ...b, [id]: v };
    });
    if (trace) {
      setTraces((t) => {
        const prev = best[id];
        return prev !== undefined && prev <= moves ? t : { ...t, [id]: trace };
      });
    }
  };

  const markHinted = (id: string) =>
    setHinted((h) => (h[id] ? h : { ...h, [id]: true }));

  return { best, hinted, traces, record, markHinted };
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (no errors from this file; unrelated pre-existing errors, if any, are out of scope).

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useBestScores.ts
git commit -m "feat(sync): persist the winning trace of each level's best clean solve"
```

---

## Task 3: Thread the trace through onWin

**Files:**

- Modify: `src/ui/hooks/useGame.ts:134`
- Modify: `src/ui/screens/PlayScreen.tsx:141`
- Modify: `src/routes/level.$plate.tsx:41`

- [ ] **Step 1: Widen the `onWin` signature in useGame**

In `src/ui/hooks/useGame.ts`, change the parameter type (around line 42):

```ts
  onWin?: (moves: number, trace: TraceStep[]) => void,
```

And the call site (around line 134), inside the `hints === 0` branch, right after `setSolve({...})`:

```ts
onWin?.(history.current.length, trace.current.slice());
```

(`TraceStep` is already imported in useGame.ts — line 11.)

- [ ] **Step 2: Widen the prop type in PlayScreen**

In `src/ui/screens/PlayScreen.tsx` (around line 141), change:

```ts
  onWin?: (moves: number, trace: TraceStep[]) => void;
```

Ensure `TraceStep` is imported at the top of PlayScreen.tsx. If it is not already imported, add it to the existing engine types import:

```ts
import type { TraceStep } from "../../engine/types.ts";
```

- [ ] **Step 3: Forward the trace in the level route**

In `src/routes/level.$plate.tsx` (around line 41), change:

```ts
      onWin={(moves, trace) => record(level.id, moves, trace)}
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS. If PlayScreen.tsx reports `TraceStep` unused or missing, correct the import per Step 2.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useGame.ts src/ui/screens/PlayScreen.tsx src/routes/level.\$plate.tsx
git commit -m "feat(sync): pass the winning trace to onWin so records can be stored"
```

---

## Task 4: Server read of the caller's level scores

**Files:**

- Modify: `src/server/campaign.ts`

- [ ] **Step 1: Add `db` to the imports**

In `src/server/campaign.ts`, add below the existing `levelScore` import (line 8):

```ts
import { db } from "../db/index.ts";
```

- [ ] **Step 2: Add the server function**

Append to `src/server/campaign.ts`:

```ts
/** Every campaign score the current user holds — `{ levelId, moves }` per level.
 *  Read-only, public shape: returns `[]` when not signed in (no throw). Feeds
 *  the client's login-time progress reconciliation (useProgressSync). */
export const getMyLevelScores = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ levelId: string; moves: number }[]> => {
    const userId = await currentUserId();
    if (!userId) return [];
    return db
      .select({ levelId: levelScore.levelId, moves: levelScore.moves })
      .from(levelScore)
      .where(eq(levelScore.userId, userId));
  },
);
```

(`createServerFn`, `eq`, `levelScore`, and `currentUserId` are already imported in this file.)

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server/campaign.ts
git commit -m "feat(sync): server fn returning the caller's campaign scores"
```

---

## Task 5: Run the sync at login

**Files:**

- Create: `src/ui/hooks/useProgressSync.ts`
- Modify: `src/routes/levels.tsx`

- [ ] **Step 1: Write the hook**

```ts
// src/ui/hooks/useProgressSync.ts
// At the moment the session resolves to a signed-in user, reconcile local
// progression with the server (planProgressSync): pull down better/absent
// server scores into `record`, and replay-submit better/absent local clean
// traces. Runs at most once per authenticated user (guarded by uid) — session
// is a fresh object each render, so we key on the user id, not the object, and
// read the mutating deps through a ref (as LeaderboardRail does for submit).

import { useEffect, useRef } from "react";
import type { TraceStep } from "../../engine/types.ts";
import { getMyLevelScores, submitLevelScore } from "../../server/campaign.ts";
import { planProgressSync } from "../progressSync.ts";

interface Deps {
  best: Record<string, number>;
  traces: Record<string, TraceStep[]>;
  record: (id: string, moves: number, trace?: TraceStep[]) => void;
}

export function useProgressSync(uid: string | null, deps: Deps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || syncedFor.current === uid) return;
    syncedFor.current = uid;
    let alive = true;

    (async () => {
      const server = await getMyLevelScores().catch(() => null);
      if (!alive || !server) {
        if (syncedFor.current === uid) syncedFor.current = null; // let a retry happen
        return;
      }
      const { best, traces, record } = depsRef.current;
      const plan = planProgressSync(best, traces, server);
      for (const d of plan.downloads) record(d.levelId, d.moves);
      // a stale/invalid trace must not break the sync — swallow per-upload
      for (const u of plan.uploads)
        await submitLevelScore({
          data: { levelId: u.levelId, trace: u.trace },
        }).catch(() => {});
    })();

    return () => {
      alive = false;
    };
  }, [uid]);
}
```

- [ ] **Step 2: Mount it on the selector route**

In `src/routes/levels.tsx`, add the import:

```ts
import { useProgressSync } from "../ui/hooks/useProgressSync.ts";
```

Change the `useBestScores()` destructure to also take `traces` and `record`:

```ts
const { best, hinted, traces, record } = useBestScores();
const { data: session } = useSession();
useProgressSync(session?.user.id ?? null, { best, traces, record });
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Full test + lint**

Run: `bunx vitest run && bunx oxlint`
Expected: all tests PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useProgressSync.ts src/routes/levels.tsx
git commit -m "feat(sync): reconcile campaign progression with the server at login"
```

---

## Task 6: Manual verification

**Files:** none (exercises the running app).

- [ ] **Step 1: Build/typecheck/lint gate**

Run: `bunx tsc --noEmit && bunx vitest run && bunx oxlint`
Expected: all green.

- [ ] **Step 2: Cross-device download**

Requires the daily-mode server running with Postgres (see README) and a test account.

1. `bun run dev`, sign in as the test user in browser A.
2. Solve a level cleanly (no hint). Confirm the ✓ + move count appears in `/levels`.
3. In a separate browser profile B, sign in as the SAME user, open `/levels`.
   Expected: the level solved in A shows its ✓ + move count in B.

- [ ] **Step 3: Cache-clear recovery**

1. In browser A, `localStorage.clear()` in DevTools, reload `/levels` (still signed in, or sign in again).
   Expected: the previously solved level's ✓ returns (pulled from the server).

- [ ] **Step 4: Anonymous backfill**

1. Sign out. Solve a fresh level cleanly while signed out (✓ appears, local only).
2. Sign in, open `/levels`.
   Expected: that level's score is now on the server (verify via the level's leaderboard rail, or by clearing localStorage and reloading — the ✓ persists).

- [ ] **Step 5: Final state**

Run: `git diff --stat main`
Expected: the files listed in the file structure section, no stray changes.

---

## Notes for the implementer

- `bunx vitest run <file>` runs a single test file; `bunx vitest run` runs all (`src/**/*.test.ts`).
- The planner (Task 1) is the only logic with branching worth testing in isolation; the hook is thin glue and is covered by the manual pass. Do not add a jsdom/React-Testing-Library harness — the repo's vitest config is deliberately node-only (`vitest.config.ts`) and none exists yet.
- Daily mode is untouched: `PlayScreen` disables demos and this sync only runs on `/levels`, which is campaign-only.
