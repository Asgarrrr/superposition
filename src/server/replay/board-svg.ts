// Server-only: renders one game state to a self-contained SVG string in the
// "light table" art direction, drawn with the fixed replay palette so every
// pixel resvg produces maps cleanly onto the GIF colour table. No React/satori
// here — a plate is a handful of rects and circles, so a plain string is both
// smaller and free of blend-mode surprises (the fused-to-white and world-drift
// effects are baked into which colour each element gets, not left to the
// renderer's compositing).

import type { GameState, Level, Pos } from "../../engine/types.ts";
import { add } from "../../engine/grid.ts";
import {
  boardSpan,
  CELL,
  cellCenter,
  PAD,
} from "../../ui/components/board-metrics.ts";

/** The fixed replay palette (index → #hex), shared with the GIF colour table.
 *  Index 0 is the box background (the GIF background key). */
export const PALETTE_HEX = [
  "#1b1713", // 0 box — the lit surface
  "#5ce3ee", // 1 cyan ink (screened bright)
  "#ff5faa", // 2 magenta ink (screened bright)
  "#f2ede4", // 3 paper white — fused / merged pawn
  "#2f5458", // 4 cyan dim — grid, walls, goal
  "#5b2f45", // 5 magenta dim
  "#e8b84b", // 6 tape amber — the locked "ready to print" marks
  "#14110e", // 7 room — outer frame
  "#6e665a", // 8 neutral dim — registration marks at rest
] as const;

const BOX = PALETTE_HEX[0];
const CYAN = PALETTE_HEX[1];
const MAGENTA = PALETTE_HEX[2];
const WHITE = PALETTE_HEX[3];
const CYAN_DIM = PALETTE_HEX[4];
const MAGENTA_DIM = PALETTE_HEX[5];
const TAPE = PALETTE_HEX[6];
const ROOM = PALETTE_HEX[7];
const NEUTRAL = PALETTE_HEX[8];

const R = (p: Pos): number => p[0];
const C = (p: Pos): number => p[1];

/** Faint grid lines for one ink layer, at a board offset (for world drift). */
function grid(n: number, color: string, shift: Pos): string {
  const dx = C(shift) * CELL;
  const dy = R(shift) * CELL;
  const lines: string[] = [];
  for (let i = 0; i <= n; i++) {
    const o = PAD + i * CELL;
    lines.push(
      `<line x1="${PAD + dx}" y1="${o + dy}" x2="${PAD + n * CELL + dx}" y2="${o + dy}"/>`,
      `<line x1="${o + dx}" y1="${PAD + dy}" x2="${o + dx}" y2="${PAD + n * CELL + dy}"/>`,
    );
  }
  return `<g stroke="${color}" stroke-width="1">${lines.join("")}</g>`;
}

/** Hatched wall cells for one ink layer, at a board offset. */
function walls(cells: Pos[], color: string, shift: Pos): string {
  const dx = C(shift) * CELL;
  const dy = R(shift) * CELL;
  return cells
    .map((w) => {
      const x = PAD + C(w) * CELL + dx;
      const y = PAD + R(w) * CELL + dy;
      return `<rect x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" fill="${color}"/>`;
    })
    .join("");
}

/** Light walls (lumiere): dashed paper squares that only block the merged pawn.
 *  They live in the shared board plane — never drifted by `off` (the engine
 *  reads them straight against the merged pawn's board coordinates) — and read
 *  brighter once merged, when they actually bite. */
function lightWalls(cells: Pos[], merged: boolean): string {
  const op = merged ? 1 : 0.4;
  return cells
    .map((w) => {
      const [x, y] = cellCenter(w);
      return `<g opacity="${op}"><rect x="${x - CELL / 2 + 8}" y="${y - CELL / 2 + 8}" width="${CELL - 16}" height="${CELL - 16}" fill="none" stroke="${WHITE}" stroke-width="2" stroke-dasharray="4 4"/><circle cx="${x}" cy="${y}" r="3" fill="${WHITE}"/></g>`;
    })
    .join("");
}

function goal(pos: Pos, color: string): string {
  const [x, y] = cellCenter(pos);
  return `<circle cx="${x}" cy="${y}" r="${CELL * 0.3}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
}

function pawn(pos: Pos, color: string, r = CELL * 0.24): string {
  const [x, y] = cellCenter(pos);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
}

/** A corner registration cross, doubled cyan/magenta when the worlds drift,
 *  fused to white on merge, locked to amber on the win. */
function regMark(
  x: number,
  y: number,
  off: Pos,
  merged: boolean,
  won: boolean,
): string {
  const arm = 9;
  const cross = (cx: number, cy: number, color: string) =>
    `<g stroke="${color}" stroke-width="2"><line x1="${cx - arm}" y1="${cy}" x2="${cx + arm}" y2="${cy}"/><line x1="${cx}" y1="${cy - arm}" x2="${cx}" y2="${cy + arm}"/></g>`;
  if (won) return cross(x, y, TAPE);
  if (merged) return cross(x, y, WHITE);
  const dx = C(off) * 3;
  const dy = R(off) * 3;
  // doubled, pulled apart by the world offset — the visual of decalage
  return (
    cross(x - dx, y - dy, CYAN) +
    cross(x + dx, y + dy, MAGENTA) +
    cross(x, y, NEUTRAL)
  );
}

/** SVG for one state. `won` locks the marks amber (the final frame). */
export function frameSvg(level: Level, st: GameState, won: boolean): string {
  const n = level.size;
  const span = boardSpan(n);
  const off = st.off;
  const parts: string[] = [];

  parts.push(
    `<rect x="0" y="0" width="${span}" height="${span}" fill="${ROOM}"/>`,
  );
  parts.push(
    `<rect x="6" y="6" width="${span - 12}" height="${span - 12}" rx="8" fill="${BOX}"/>`,
  );
  // the drifting magenta grid is clipped to the box, mirroring the live board
  // where the whole shifted ink layer sits under an `overflow-hidden` frame
  parts.push(
    `<defs><clipPath id="box"><rect x="6" y="6" width="${span - 12}" height="${span - 12}" rx="8"/></clipPath></defs>`,
  );

  // cyan layer sits in board coordinates; magenta layer drifts by `off` — both
  // grids exist at all times (like the two ink films), only magenta's moves
  parts.push(grid(n, CYAN_DIM, [0, 0]));
  parts.push(`<g clip-path="url(#box)">${grid(n, MAGENTA_DIM, off)}</g>`);
  parts.push(walls(level.a.walls, CYAN_DIM, [0, 0]));
  parts.push(walls(level.b.walls, MAGENTA_DIM, off));
  parts.push(goal(level.a.goal, CYAN_DIM));
  parts.push(goal(add(level.b.goal, off), MAGENTA_DIM));

  if (st.merged) {
    parts.push(pawn(st.m, WHITE, CELL * 0.26));
  } else {
    parts.push(pawn(st.a, CYAN));
    parts.push(pawn(add(st.b, off), MAGENTA));
  }

  // shared plane, on top of the inks and under the registration marks
  if (level.lightWalls?.length)
    parts.push(lightWalls(level.lightWalls, st.merged));

  const marks: [number, number][] = [
    [PAD, PAD],
    [span - PAD, PAD],
    [PAD, span - PAD],
    [span - PAD, span - PAD],
  ];
  for (const [mx, my] of marks)
    parts.push(regMark(mx, my, off, st.merged, won));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" width="${span}" height="${span}">${parts.join("")}</svg>`;
}
