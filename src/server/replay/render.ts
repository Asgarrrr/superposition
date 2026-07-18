// Server-only: turns a compact replay URL into an animated GIF of the solve.
// The server trusts nothing the client asserts — it re-resolves the level from
// its own data and replays the decoded line through the SHARED engine
// (applyInput / isWin, the same code the anti-cheat uses), rejecting anything
// that doesn't legally win. Pulls in resvg, the DB (for daily) and the fixed
// palette, so it's loaded via dynamic import from the route handler and never
// reaches the client bundle.

import { Resvg } from "@resvg/resvg-js";
import type { GameState, Input, Level } from "../../engine/types.ts";
import { initialState, isWin } from "../../engine/state.ts";
import { applyInput } from "../../engine/successors.ts";
import { LEVELS } from "../../engine/levels.ts";
import { decodeTrace } from "../../lib/replayTrace.ts";
import { isValidDay, utcDay } from "../../lib/day.ts";
import { Lru } from "../../lib/lru.ts";
import { encodeGif, type GifFrame } from "./gif.ts";
import { frameSvg, PALETTE_HEX } from "./board-svg.ts";
// `../daily.ts` (and the DB it pulls in) is imported lazily inside the daily
// branch, so this module stays DB-free — testable without DATABASE_URL, and the
// campaign path never touches Postgres.

const RENDER_WIDTH = 300; // ~300px, per the share spec
const FRAME_CS = 50; // ~2 frames/s
const LAST_CS = 250; // a longer beat on the solved plate

const PALETTE_RGB = PALETTE_HEX.map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]) as [number, number, number][];

const notFound = () => new Response("Not found", { status: 404 });

// Load-shedding: past the concurrency cap the endpoint tells the client to back
// off instead of piling more rasterization onto the single vCPU.
const tooBusy = () =>
  new Response("Too many replays in flight", {
    status: 429,
    headers: { "retry-after": "2" },
  });

/** 301 to the one canonical form of a splat, so caches (browser, CDN, and the
 *  in-memory GIF cache) key on a single URL per replay. */
const redirectTo = (splat: string) =>
  new Response(null, {
    status: 301,
    headers: { location: `/api/replay/${splat}` },
  });

// A replay GIF is fully determined by (shape, level identity, decoded line) and
// is ≤ ~150 KB, so cache the rendered bytes: a re-share or a crawler hitting the
// same URL returns instantly and never re-rasterizes. Bounded so a stream of
// distinct valid traces (cheap to mint) can't grow memory without limit.
const RENDER_CACHE = new Lru<string, Uint8Array>(64);

// A hard cap on rasterizations running at once. On one vCPU this is the ceiling
// on CPU an anonymous flood can claim: excess requests get 429, not a slot.
const MAX_CONCURRENT_RENDERS = 3;
let activeRenders = 0;

/** Runs `render` under the concurrency cap, or returns null when already at the
 *  cap (caller → 429). Yields the event loop once inside the slot before the
 *  synchronous raster work, so a burst is admitted-or-shed up front rather than
 *  each request monopolizing the vCPU in turn. Exported for the cap's test. */
export async function withRenderSlot<T>(
  render: () => T | Promise<T>,
): Promise<T | null> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) return null;
  activeRenders++;
  try {
    return await render();
  } finally {
    activeRenders--;
  }
}

/** Replays the decoded line through the shared engine, collecting every state
 *  of the winning line. Null on any illegal move or a non-winning final state —
 *  the same verdict the anti-cheat reaches, just keeping the states for frames. */
function replayStates(level: Level, inputs: Input[]): GameState[] | null {
  const states: GameState[] = [initialState(level)];
  for (const inp of inputs) {
    const next = applyInput(states[states.length - 1], level, inp);
    if (!next) return null;
    states.push(next);
  }
  if (!isWin(states[states.length - 1], level)) return null;
  return states;
}

/** Nearest fixed-palette index for an RGB triple, memoised — resvg antialiases,
 *  so edge pixels land between palette colours and snap to the closest. */
const quantCache = new Map<number, number>();
function nearest(r: number, g: number, b: number): number {
  const key = (r << 16) | (g << 8) | b;
  const hit = quantCache.get(key);
  if (hit !== undefined) return hit;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE_RGB.length; i++) {
    const [pr, pg, pb] = PALETTE_RGB[i];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  quantCache.set(key, best);
  return best;
}

/** SVG → resvg PNG raster → palette-indexed frame. */
function rasterFrame(
  svg: string,
  delayCs: number,
): GifFrame & { w: number; h: number } {
  const img = new Resvg(svg, {
    fitTo: { mode: "width", value: RENDER_WIDTH },
  }).render();
  const { pixels, width, height } = img;
  const indices = new Uint8Array(width * height);
  for (let i = 0; i < indices.length; i++) {
    const p = i * 4;
    indices[i] = nearest(pixels[p], pixels[p + 1], pixels[p + 2]);
  }
  return { indices, delayCs, w: width, h: height };
}

/** Rasterizes every state to a palette frame and encodes the GIF. Async so it
 *  yields the event loop before committing the vCPU (see withRenderSlot). */
async function renderGifBytes(
  level: Level,
  states: GameState[],
): Promise<Uint8Array> {
  await new Promise((resolve) => setImmediate(resolve));
  const raster = states.map((st, i) =>
    rasterFrame(
      frameSvg(level, st, i === states.length - 1),
      i === states.length - 1 ? LAST_CS : FRAME_CS,
    ),
  );
  return encodeGif({
    width: raster[0].w,
    height: raster[0].h,
    palette: PALETTE_RGB,
    frames: raster.map(({ indices, delayCs }) => ({ indices, delayCs })),
  });
}

function gifResponse(gif: Uint8Array): Response {
  return new Response(gif as unknown as BodyInit, {
    headers: {
      "content-type": "image/gif",
      // same URL ⇒ same GIF forever: the trace and level fully determine it
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/** Resolves a validated replay to a GIF response: serve the cached bytes, else
 *  replay-validate the line, render under the concurrency cap (429 when full),
 *  and cache. `cacheKey` folds shape, level identity and the decoded line. */
async function replayGif(
  cacheKey: string,
  level: Level,
  inputs: Input[],
): Promise<Response> {
  const cached = RENDER_CACHE.get(cacheKey);
  if (cached) return gifResponse(cached);

  const states = replayStates(level, inputs);
  if (!states) return notFound();

  const gif = await withRenderSlot(() => renderGifBytes(level, states));
  if (!gif) return tooBusy();

  RENDER_CACHE.set(cacheKey, gif);
  return gifResponse(gif);
}

/** Resolves the campaign level for a canonical 1-based plate, or null. */
function campaignLevel(plate: string): Level | null {
  const idx = Number(plate) - 1;
  const level = LEVELS[idx];
  // reject non-canonical forms ("01", "1e1", "0x1") Number() would accept
  if (!level || String(idx + 1) !== plate) return null;
  return level;
}

/**
 * Renders the replay GIF for a splat path. Two shapes:
 *   c/<plate>/<trace>.gif        campaign — always renderable
 *   d/<date>/<tier>/<trace>.gif  daily — only once the puzzle's day is past
 *                                (UTC), else 403, so a fresh daily can't be
 *                                spoiled.
 * There is exactly ONE canonical form (a trailing ".gif", no empty segments);
 * any variant 301s to it, so every cache keys on a single URL per replay.
 * Invalid input, an illegal trace, or a non-winning line all return 404.
 */
export async function replayResponse(splat: string): Promise<Response> {
  const segs = splat.split("/").filter(Boolean);
  if (segs.length < 2) return notFound();

  // Canonicalize: drop empty segments (already gone via filter) and pin the
  // ".gif" suffix. Any input that isn't already this exact string is a variant.
  const raw = segs[segs.length - 1].replace(/\.gif$/, "");
  const canonical = [...segs.slice(0, -1), `${raw}.gif`].join("/");
  if (canonical !== splat) return redirectTo(canonical);

  const inputs = decodeTrace(raw);
  if (!inputs) return notFound();

  if (segs[0] === "c" && segs.length === 3) {
    const level = campaignLevel(segs[1]);
    if (!level) return notFound();
    return replayGif(`c:${level.id}|${raw}`, level, inputs);
  }

  if (segs[0] === "d" && segs.length === 4) {
    const date = segs[1];
    const tier = Number(segs[2]);
    if (!isValidDay(date) || !Number.isInteger(tier) || tier < 0 || tier > 3)
      return notFound();
    // anti-spoil: a daily replay is public only once its day has fully passed
    if (date >= utcDay()) return new Response("Not yet", { status: 403 });
    const { replayPuzzle } = await import("../daily.ts");
    const puzzle = await replayPuzzle(date, tier);
    if (!puzzle) return notFound();
    return replayGif(`d:${date}:${tier}|${raw}`, puzzle.level, inputs);
  }

  return notFound();
}
