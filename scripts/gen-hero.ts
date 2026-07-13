// Regenerates the README hero (docs/media/board.webp): the last level, solved
// by the BFS solver, rasterized frame by frame and encoded as an animated WebP.
//
//   bun scripts/gen-hero.ts
//
// External tools required on PATH: ffmpeg (raw frames -> PNG) and img2webp
// (PNG -> animated WebP, from the `webp` package: `brew install webp`).
// Renders the SAME visuals as the live game (see src/ui/components/Board.tsx):
// two ink films in `screen` blend, the magenta world shifted by `off`
// (decalage), pawns overlapping to white on fusion, amber registration marks
// once solved.

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { LEVELS } from '../src/engine/levels.ts'
import { initialState } from '../src/engine/state.ts'
import { successors } from '../src/engine/successors.ts'
import { solve } from '../src/solver/bfs.ts'
import type { GameState, Input, Pos } from '../src/engine/types.ts'

// ── solve the last level and replay the trajectory ───────────────────────────
const level = LEVELS[LEVELS.length - 1]
const sol = solve(level)
if (!sol) throw new Error(`no solution for ${level.id}`)
const same = (a: Input, b: Input) => a.kind === b.kind && a.dir[0] === b.dir[0] && a.dir[1] === b.dir[1]
let s: GameState = initialState(level)
const states: GameState[] = [s]
const kinds: string[] = ['start']
for (const inp of sol.inputs) {
  const succ = successors(s, level).find(([i]) => same(i, inp))
  if (!succ) throw new Error('replay mismatch')
  s = succ[1]
  states.push(s)
  kinds.push(inp.kind)
}

// ── raster primitives (supersampled, then box-averaged) ──────────────────────
const S = 332, SS = 3, HW = S * SS, OUT = S
const CELL = 56, PAD = 26, SIZE = level.size, FPS = 13

const room = [20, 17, 14], boxC = [36, 31, 25], boxE = [27, 23, 19]
const cyan = [69, 224, 236], magenta = [255, 79, 163], paper = [242, 237, 228], tape = [232, 184, 75]

type RGB = number[]; type P2 = [number, number]
const buf = new Uint8ClampedArray(HW * HW * 3)
const K = (v: number) => v * SS
const cc = (r: number, c: number): P2 => [54 + c * CELL, 54 + r * CELL]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const back = (t: number) => { const k = 1.6; return 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2) }

function px(x: number, y: number, c: RGB, a: number, screen = false) {
  if (a <= 0 || x < 0 || y < 0 || x >= HW || y >= HW) return
  if (a > 1) a = 1
  const i = (y * HW + x) * 3
  for (let k = 0; k < 3; k++) { const d = buf[i + k]; let v = c[k]; if (screen) v = 255 - ((255 - v) * (255 - d)) / 255; buf[i + k] = d * (1 - a) + v * a }
}
function disc(cx: number, cy: number, r: number, c: RGB, a: number, screen = false) {
  const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, c, a * Math.min(1, Math.max(0, r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy))), screen)
}
function seg(ax: number, ay: number, bx: number, by: number, w: number, c: RGB, a: number, screen = false) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay)); for (let i = 0; i <= n; i++) { const t = i / n; disc(ax + (bx - ax) * t, ay + (by - ay) * t, w / 2, c, a, screen) }
}
function ring(cx: number, cy: number, r: number, w: number, c: RGB, a: number, dash = 0, screen = false) {
  const n = Math.ceil(2 * Math.PI * r); for (let i = 0; i < n; i++) { const ang = (i / n) * 2 * Math.PI; if (dash > 0 && Math.floor((ang * r) / (dash * SS)) % 2 === 1) continue; disc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, w / 2, c, a, screen) }
}
function rect(x: number, y: number, w: number, h: number, c: RGB, a: number, screen = false) {
  for (let yy = Math.floor(y); yy < y + h; yy++) for (let xx = Math.floor(x); xx < x + w; xx++) px(xx, yy, c, a, screen)
}

function film(color: RGB, pawn: P2, goal: Pos, walls: Pos[], ox: number, oy: number, mis: number, pawnR: number) {
  const tx = (v: number) => K(v + ox), ty = (v: number) => K(v + oy)
  for (let i = 0; i <= SIZE; i++) {
    seg(tx(PAD), ty(PAD + i * CELL), tx(PAD + SIZE * CELL), ty(PAD + i * CELL), K(1), color, 0.22, true)
    seg(tx(PAD + i * CELL), ty(PAD), tx(PAD + i * CELL), ty(PAD + SIZE * CELL), K(1), color, 0.22, true)
  }
  const wf = 0.3 + 0.7 * mis
  for (const [r, c] of walls) {
    rect(tx(PAD + c * CELL + 4), ty(PAD + r * CELL + 4), K(CELL - 8), K(CELL - 8), color, 0.14 * wf, true)
    for (let k = 0; k < 4; k++) seg(tx(PAD + c * CELL + 6 + k * 12), ty(PAD + r * CELL + CELL - 6), tx(PAD + c * CELL + CELL - 6), ty(PAD + r * CELL + 6 + k * 12), K(2), color, 0.7 * wf, true)
  }
  const [gx, gy] = cc(goal[0], goal[1])
  const onGoal = Math.hypot(pawn[0] - goal[0], pawn[1] - goal[1]) < 0.06
  ring(tx(gx), ty(gy), K(CELL * 0.3), K(2.5), color, 0.9, onGoal ? 0 : 5, true)
  const [pcx, pcy] = cc(pawn[0], pawn[1])
  disc(tx(pcx), ty(pcy), K(pawnR), color, 1, true)
}

function regmark(x: number, y: number, offPx: P2, merged: boolean, solved: boolean) {
  const cross = (c: RGB, dx: number, dy: number, op: number) => {
    seg(K(x + dx - 7), K(y + dy), K(x + dx + 7), K(y + dy), K(1.2), c, op)
    seg(K(x + dx), K(y + dy - 7), K(x + dx), K(y + dy + 7), K(1.2), c, op)
    ring(K(x + dx), K(y + dy), K(4.2), K(1.2), c, op)
  }
  if (solved) cross(tape, 0, 0, 1)
  else if (merged) cross(paper, 0, 0, 0.9)
  else { cross(cyan, 0, 0, 0.85); cross(magenta, offPx[0], offPx[1], 0.85) }
}

const chan = (st: GameState) => {
  const merged = st.merged
  const off = st.off as Pos
  const cyanCell: P2 = merged ? [st.m[0], st.m[1]] : [st.a[0], st.a[1]]
  const magCell: P2 = merged ? [st.m[0] - off[0], st.m[1] - off[1]] : [st.b[0], st.b[1]]
  return { cyanCell, magCell, off: [off[0], off[1]] as P2, merged }
}
const GA = level.a.goal, GB = level.b.goal, AW = level.a.walls, BW = level.b.walls

function render(cyanCell: P2, magCell: P2, off: P2, mis: number, merged: boolean, solved: boolean, blooms: Pos[], bloomP: number) {
  const cx = HW / 2, cy = HW / 2, maxr = HW * 0.55
  for (let y = 0; y < HW; y++) for (let x = 0; x < HW; x++) {
    const i = (y * HW + x) * 3
    const inBox = x >= K(6) && x < K(326) && y >= K(6) && y < K(326)
    let c: RGB = room
    if (inBox) { const d = Math.min(1, Math.hypot(x - cx, y - cy) / maxr); c = [lerp(boxC[0], boxE[0], d), lerp(boxC[1], boxE[1], d), lerp(boxC[2], boxE[2], d)] }
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]
  }
  const pawnR = 0.2 * CELL + 0.04 * CELL * (1 - mis)
  film(cyan, cyanCell, GA, AW, 4 * mis, -4 * mis, mis, pawnR)
  film(magenta, magCell, GB, BW, off[1] * CELL - 4 * mis, off[0] * CELL + 4 * mis, mis, pawnR)
  const offPx: P2 = [off[1] * 5, off[0] * 5]
  for (const [x, y] of [[13, 13], [319, 13], [13, 319], [319, 319]] as P2[]) regmark(x, y, offPx, merged, solved)
  if (bloomP > 0) for (const g of blooms) { const [bx, by] = cc(g[0], g[1]); ring(K(bx), K(by), K(CELL * (0.35 + 0.4 * bloomP)), K(2.5), paper, (1 - bloomP) * 0.85) }
}

function downscale(): Uint8Array {
  const out = new Uint8Array(OUT * OUT * 3), f = SS
  for (let y = 0; y < OUT; y++) for (let x = 0; x < OUT; x++) {
    let r = 0, g = 0, b = 0
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) { const i = ((y * f + dy) * HW + (x * f + dx)) * 3; r += buf[i]; g += buf[i + 1]; b += buf[i + 2] }
    const n = f * f, o = (y * OUT + x) * 3; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n
  }
  return out
}

// ── segments: one per solver step, plus holds on fusion and the final lock ───
const durOf = (k: string) => (k === 'shift' ? 0.3 : k === 'split' ? 0.34 : 0.17)
const easeOf = (k: string) => (k === 'shift' ? back : smooth)
type Seg = { from: ReturnType<typeof chan>; to: ReturnType<typeof chan>; dur: number; ease: (t: number) => number; bloom?: Pos[]; solved?: boolean }
const C = states.map(chan)
const segs: Seg[] = [{ from: C[0], to: C[0], dur: 0.5, ease: (t) => t }]
for (let i = 1; i < C.length; i++) {
  const fusion = C[i].merged && !C[i - 1].merged
  const m = (states[i] as { merged: true; m: Pos }).m
  segs.push({ from: C[i - 1], to: C[i], dur: durOf(kinds[i]), ease: easeOf(kinds[i]), bloom: fusion ? [m] : undefined })
  if (fusion) segs.push({ from: C[i], to: C[i], dur: 0.28, ease: (t) => t, bloom: [m] })
}
const last = C[C.length - 1]
segs.push({ from: last, to: last, dur: 0.9, ease: (t) => t, solved: true, bloom: [GA, GB] })
segs.push({ from: last, to: C[0], dur: 0.3, ease: smooth })

const frames: Uint8Array[] = []
for (const sg of segs) {
  const nf = Math.max(1, Math.round(sg.dur * FPS))
  for (let i = 0; i < nf; i++) {
    const t = sg.ease(i / nf)
    const cyanCell: P2 = [lerp(sg.from.cyanCell[0], sg.to.cyanCell[0], t), lerp(sg.from.cyanCell[1], sg.to.cyanCell[1], t)]
    const magCell: P2 = [lerp(sg.from.magCell[0], sg.to.magCell[0], t), lerp(sg.from.magCell[1], sg.to.magCell[1], t)]
    const off: P2 = [lerp(sg.from.off[0], sg.to.off[0], t), lerp(sg.from.off[1], sg.to.off[1], t)]
    const solved = !!sg.solved
    const merged = sg.to.merged
    const mis = lerp(sg.from.merged ? 0 : 1, merged || solved ? 0 : 1, smooth(i / nf))
    const bloomP = sg.bloom ? (sg.from === sg.to && !sg.solved ? 1 - i / nf : smooth(i / nf)) : 0
    render(cyanCell, magCell, off, mis, merged, solved, sg.bloom ?? [], bloomP)
    frames.push(downscale())
  }
}
console.error(`rasterized ${frames.length} frames`)

// ── encode: raw -> PNG (ffmpeg) -> animated WebP (img2webp) ───────────────────
const dir = mkdtempSync(join(tmpdir(), 'sp-hero-'))
const raw = join(dir, 'frames.raw')
const blob = new Uint8Array(frames.reduce((n, f) => n + f.length, 0))
let o = 0; for (const f of frames) { blob.set(f, o); o += f.length }
await Bun.write(raw, blob)

const run = async (cmd: string[]) => {
  const p = Bun.spawn(cmd, { stderr: 'pipe' })
  const code = await p.exited
  if (code !== 0) throw new Error(`${cmd[0]} exited ${code}: ${await new Response(p.stderr).text()}`)
}
await run(['ffmpeg', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', `${OUT}x${OUT}`,
  '-i', raw, '-vf', 'scale=300:300:flags=lanczos', join(dir, '%03d.png'), '-loglevel', 'error'])
const pngs = Array.from({ length: frames.length }, (_, i) => join(dir, String(i + 1).padStart(3, '0') + '.png'))
const out = join(import.meta.dir, '..', 'docs', 'media', 'board.webp')
await run(['img2webp', '-loop', '0', '-d', String(Math.round(1000 / FPS)), '-lossy', '-q', '85', '-m', '6', ...pngs, '-o', out])
rmSync(dir, { recursive: true, force: true })
console.error(`wrote ${out}`)
