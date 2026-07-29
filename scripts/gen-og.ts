// Regenerates the site's Open Graph cards (public/og-fr.png, public/og-en.png):
// the light table seen from above, one real board laid on it, the wordmark
// printed over it. One card per language — the sentence is the only thing that
// differs, and it is read from the inlang catalogue so there is a single source
// of truth with the og:description tag.
//
//   bun scripts/gen-og.ts
//
// Hand-authored SVG rasterized with @resvg/resvg-js rather than satori (which
// the per-profile card at src/server/og/card.tsx uses): satori implements a
// subset of flexbox and no `mix-blend-mode`, and the screen blend between the
// two inks IS the game's signature — the whites in the wordmark and where the
// two films overlap are the blend, not a fill. resvg does support it.
//
// The visuals mirror src/ui/components/{InkLayer,RegMark}.tsx exactly. Change
// one there and this drifts; the values are duplicated on purpose, the same way
// scripts/gen-hero.ts redraws the board for the README animation.

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEVELS } from "../src/engine/levels.ts";
import { initialState } from "../src/engine/state.ts";
import { add } from "../src/engine/grid.ts";
import type { Level, Pos } from "../src/engine/types.ts";
import { CELL, PAD, cellCenter } from "../src/ui/components/board-metrics.ts";

const W = 1200;
const H = 630; // the 1.91:1 Open Graph frame

// tokens from @theme in src/index.css
const CYAN = "#45e0ec";
const MAGENTA = "#ff4fa3";
const PAPER = "#f2ede4";
const ROOM = "#14110e";
const BOX_GLOW = "#241f19";

// `abysse` is picked, not arbitrary: of the 22 boards it is the one whose
// middle row — the band the wordmark crosses at this scale — is completely
// empty, while five of its elements sit in the outer columns so the plate
// carries matter all the way to both edges. It also has no `lumiere` walls,
// whose dashed white squares fought with the type.
const LEVEL_ID = "abysse";
const SCALE = 2.3; // one cell renders at 129px; five rows overflow the frame
const TRAME_OPACITY = 0.55;
const MATTER_OPACITY = 0.5;

const root = join(import.meta.dir, "..");
const FONTS = [
  join(root, "src/server/og/fonts/InstrumentSerif-Italic.ttf"),
  join(root, "src/server/og/fonts/InstrumentSerif-Regular.ttf"),
];

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level "${id}" in the bank`);
  return found;
};

/** One ink film's matter — hatched walls, goal ring, pawn — in `screen` blend.
 *  The grid is drawn separately (see `trame`) so it can run past the board. */
function matter(
  color: string,
  pawn: Pos,
  goal: Pos,
  walls: Pos[],
  misreg: number,
  shift: Pos,
): string {
  const parts: string[] = [];

  for (const [r, c] of walls) {
    const x = PAD + c * CELL;
    const y = PAD + r * CELL;
    const hatch = [0, 1, 2, 3]
      .map(
        (k) =>
          `<line x1="${x + 6 + k * 12}" y1="${y + CELL - 6}" x2="${x + CELL - 6}" y2="${y + 6 + k * 12}" stroke="${color}" stroke-width="2" stroke-opacity="0.7"/>`,
      )
      .join("");
    parts.push(
      `<g><rect x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" fill="${color}" fill-opacity="0.14"/>${hatch}</g>`,
    );
  }

  const [gx, gy] = cellCenter(goal);
  parts.push(
    `<circle cx="${gx}" cy="${gy}" r="${CELL * 0.3}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="5 5"/>`,
  );

  const [px, py] = cellCenter(pawn);
  parts.push(
    `<circle cx="${px}" cy="${py}" r="${CELL * 0.2}" fill="${color}"/>`,
  );

  // `misreg` is InkLayer's at-rest misalignment: the two films never sit
  // perfectly on each other until the board is solved
  return `<g style="mix-blend-mode:screen" transform="translate(${misreg}, ${-misreg}) translate(${shift[1] * CELL}, ${shift[0] * CELL})">${parts.join("")}</g>`;
}

/** One ink film's grid, running the full frame in phase with the board's cells.
 *  A 5×5 plate cannot fill a 1.91:1 frame without zooming past legibility, so
 *  the table's trame carries the edges while the game's matter stays centred. */
function trame(
  color: string,
  ox: number,
  oy: number,
  shift: Pos,
  misreg: number,
): string {
  const step = CELL * SCALE;
  const x0 = ox + (PAD + shift[1] * CELL + misreg) * SCALE;
  const y0 = oy + (PAD + shift[0] * CELL - misreg) * SCALE;
  const lines: string[] = [];
  for (let x = x0 % step; x <= W; x += step)
    lines.push(
      `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}"/>`,
    );
  for (let y = y0 % step; y <= H; y += step)
    lines.push(
      `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`,
    );
  return `<g stroke="${color}" stroke-opacity="0.22" stroke-width="1" style="mix-blend-mode:screen">${lines.join("")}</g>`;
}

/** Wordmark.tsx: two ink layers in `screen`, no paper layer — the white core is
 *  where cyan and magenta overlap, the fringes are where they do not. */
function wordmark(cx: number, y: number, size: number): string {
  const layer = (color: string, dx: number, dy: number) =>
    `<text x="${cx + dx}" y="${y + dy}" text-anchor="middle" font-family="Instrument Serif" font-style="italic" font-size="${size}" letter-spacing="${size * 0.06}" fill="${color}" style="mix-blend-mode:screen">Superposition</text>`;
  return `<g style="isolation:isolate">${layer(CYAN, -2.5, -1.5)}${layer(MAGENTA, 2.5, 1.5)}</g>`;
}

/** RegMark.tsx's circled cross, doubled cyan/magenta, scaled up for the frame. */
function regMark(x: number, y: number, k: number): string {
  const cross = (color: string, dx: number, dy: number) =>
    `<g opacity="0.85" transform="translate(${x + dx}, ${y + dy})"><line x1="${-7 * k}" y1="0" x2="${7 * k}" y2="0" stroke="${color}" stroke-width="${1.2 * k}"/><line x1="0" y1="${-7 * k}" x2="0" y2="${7 * k}" stroke="${color}" stroke-width="${1.2 * k}"/><circle r="${4.2 * k}" fill="none" stroke="${color}" stroke-width="${1.2 * k}"/></g>`;
  return cross(CYAN, 0, 0) + cross(MAGENTA, 3, 3);
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function card(tagline: string): string {
  const lv = level(LEVEL_ID);
  const st = initialState(lv);
  const size = (lv.size * CELL + PAD * 2) * SCALE;
  const ox = (W - size) / 2;
  const oy = (H - size) / 2;

  const parts: string[] = [];

  parts.push(
    `<defs>` +
      `<radialGradient id="wash" cx="0.5" cy="0.46" r="0.70"><stop offset="0" stop-color="${BOX_GLOW}"/><stop offset="0.44" stop-color="#1a1611"/><stop offset="0.88" stop-color="${ROOM}"/></radialGradient>` +
      // the lamp falls off toward the corners, so the trame has no hard stop
      `<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.62"><stop offset="0.35" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></radialGradient>` +
      `<mask id="falloff"><rect width="${W}" height="${H}" fill="url(#vignette)"/></mask>` +
      `<clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>` +
      `</defs>`,
  );

  parts.push(`<rect width="${W}" height="${H}" fill="url(#wash)"/>`);

  parts.push(
    `<g mask="url(#falloff)" opacity="${TRAME_OPACITY}" style="isolation:isolate">` +
      trame(CYAN, ox, oy, [0, 0], 4) +
      trame(MAGENTA, ox, oy, st.off, -4) +
      `</g>`,
  );

  parts.push(
    `<g clip-path="url(#frame)" opacity="${MATTER_OPACITY}" style="isolation:isolate"><g transform="translate(${ox}, ${oy}) scale(${SCALE})">` +
      matter(CYAN, st.a, lv.a.goal, lv.a.walls, 4, [0, 0]) +
      matter(MAGENTA, add(st.b, st.off), lv.b.goal, lv.b.walls, -4, st.off) +
      `</g></g>`,
  );

  parts.push(wordmark(600, 322, 106));
  parts.push(
    `<text x="600" y="398" text-anchor="middle" font-family="Instrument Serif" font-style="italic" font-size="36" fill="${PAPER}" opacity="0.82">${escape(tagline)}</text>`,
  );

  for (const [x, y] of [
    [44, 44],
    [W - 44, 44],
    [44, H - 44],
    [W - 44, H - 44],
  ] as [number, number][])
    parts.push(regMark(x, y, 1.5));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join("")}</svg>`;
}

// the printed sentence comes from the same catalogue entry as og:description's
// sibling key, so the image and the tag can never disagree about the wording
const catalogue = (locale: string): Record<string, string> =>
  JSON.parse(
    readFileSync(join(root, `project.inlang/messages/${locale}.json`), "utf8"),
  );

// driven by the inlang project rather than a list of our own: __root.tsx builds
// the path from the resolved locale, so a language configured there without a
// card here would ask for a PNG that doesn't exist
const { locales } = JSON.parse(
  readFileSync(join(root, "project.inlang/settings.json"), "utf8"),
) as { locales: string[] };

for (const locale of locales) {
  const tagline = catalogue(locale).og_tagline;
  if (!tagline) throw new Error(`no og_tagline in ${locale}.json`);
  const png = new Resvg(card(tagline), {
    font: { fontFiles: FONTS, loadSystemFonts: false },
    fitTo: { mode: "width", value: W },
  })
    .render()
    .asPng();
  const out = join(root, "public", `og-${locale}.png`);
  writeFileSync(out, png);
  console.error(
    `wrote public/og-${locale}.png (${W}×${H}, ${Math.round(png.length / 1024)} ko)`,
  );
}
