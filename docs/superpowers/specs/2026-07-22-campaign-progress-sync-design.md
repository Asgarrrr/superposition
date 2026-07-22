# Campaign progress sync

Status: design (this document). Next step: implementation plan.

## Problem

A player's campaign progression — the ✓ marks and best-move counts in the level
selector (`SelectScreen.tsx:203`) — lives only in `localStorage`
(`useBestScores`, keyed `superposition.best`). `localStorage` is per-browser and
per-device, so the progression is trapped on one device and lost on a cache
clear.

Observed with a real player: signed in on both a laptop and a phone, she
completes levels on the laptop, but on the phone those levels still show as
unsolved. Her laptop wins are already in the database — a signed-in win
auto-submits to `levelScore` (`LeaderboardRail` posts on the solve edge, and the
rail is mounted during play on every viewport, `PlayScreen.tsx:73-74`). The
phone simply never reads the database: its selector reflects only the phone's
own `localStorage`.

So the completion data already exists server-side for signed-in players; the UI
just never reconciles the two sources.

## Decision

Reconcile `localStorage` progression with the `levelScore` table **at login**,
in both directions. `localStorage` stays the source of truth for the anonymous
and offline player (the game is deliberately client-only); the database becomes
a durable, cross-device backup for the signed-in player.

- **When:** once per signed-in session, when the session resolves to
  authenticated.
- **Downward (fixes the observed case):** pull the user's `levelScore` rows and
  merge into `best` — `best[id] = min(local, server)`. A level solved on
  another device appears in the selector.
- **Upward (backfill):** for each level where the local record is a _clean_
  solve (no hint) and strictly better than the server's — or absent server-side
  — replay the locally stored winning trace through the existing
  `submitLevelScore` server function. The server validates the trace and writes
  the row. No new trust surface: the server still derives the move count itself.

## Why not "move completion to the DB instead of localStorage"

The game is client-only by design (README) — playable with no account, offline
as a PWA. Making completion DB-only would break both. `localStorage` is the
correct default for the anonymous/offline baseline; the database is additive
durability for those who sign in. Cross-device sync fundamentally requires a
shared server-side identity — there is no way around a login for that. The
player in the observed case is signed in on both devices, so this design covers
her directly.

## Approach

Purely additive: one new `localStorage` key, one new read-only server function,
one new hook. No engine change, no DB migration, no change to the existing
in-play auto-submit or to daily mode.

### 1. Persist the winning trace locally (`useBestScores`)

Today `useGame` produces `solve = { trace, moves }` at the win edge
(`useGame.ts:52`) for every win, anonymous included; the trace is used for
auto-submit when signed in and dropped otherwise. To enable the upward sync we
must keep it.

- New key `superposition.traces`: `Record<levelId, TraceStep[]>`, the winning
  trace of the **current best** clean solve per level.
- `record(id, moves, trace)` gains the trace argument. It writes the trace only
  when this solve becomes the new best (mirrors the existing `min` guard), so a
  worse replay never overwrites the better line's trace.
- Hinted solves stay traceless — they are already "off the record" and cannot be
  server-validated. Consistent with today's behavior.

### 2. Read server scores (`src/server/campaign.ts`)

New server function `getMyLevelScores` (GET):

- Returns `{ levelId, moves }[]` for the current user (query `levelScore`
  filtered by `userId`).
- Returns `[]` when not signed in. Public shape, no throw — a read.

### 3. Reconcile at login (`useProgressSync`)

New hook, mounted once high in the tree (where the session is already read).
When the session transitions to authenticated:

1. `getMyLevelScores()` → for each returned level, `record(levelId, moves)` so
   `best[id] = min(local, server)`. Server-only levels now show in the selector.
2. For each local level that is a clean solve (has a stored trace) and is either
   absent from the server set or strictly better than it, call
   `submitLevelScore({ levelId, trace })`. Validation failures are swallowed
   (a stale/invalid trace must not break sync).
3. Runs at most once per authenticated session — guarded by a ref/flag so it
   does not replay on every render. Re-runs on account change (sign out / sign
   in as someone else).

### Data flow

```
win (clean) ─► useBestScores: best[id]=moves + traces[id]=trace   (localStorage)
login ─► useProgressSync
          ├─ getMyLevelScores ─► merge min ─► best  (selector ✓ marks)
          └─ better local traces ─► submitLevelScore ─► levelScore (DB)
```

## What is intentionally out of scope

- Anonymous cross-device sync (no account). Impossible without a shared
  identity; the observed case is signed in, so not needed. If ever wanted, it is
  a separate "sync code" feature.
- Retroactive recovery of pre-feature completions that never reached the DB and
  have no stored trace — unrecoverable by construction. Everything from this
  feature forward syncs. Completions already in `levelScore` are recovered by
  the downward sync regardless of when they were earned.
- The `hinted` set. Hinted solves have no verifiable trace; they remain
  local-only. (A future pass could sync a "solved-with-hint" flag, but it is not
  part of this design.)

## Testing

- Unit test on the reconciliation function (pure, given local `best`/`traces`
  and a server score list): asserts `min` per level downward, and that upward
  submission is selected only for clean local records strictly better than (or
  absent from) the server.
- Manual: solve a level signed in on browser A; in browser B (signed in as the
  same user) confirm the ✓ appears after login. Clear browser A's
  `localStorage`, reload, log in, confirm the ✓ returns.

## Risk / rollback

Additive only — new `localStorage` key, new read RPC, new hook. No schema
migration. Rollback is removing the hook; existing data stays consistent
(`useBestScores` behaves exactly as before, the extra `traces` key is simply
ignored).
