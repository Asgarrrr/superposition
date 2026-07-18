// Regenerates the PWA icon set from public/favicon.svg — the doubled cyan/
// magenta registration cross, the game's mark. One source of truth (the SVG),
// rasterized with the server's own @resvg/resvg-js (already a dependency for
// the OG images), so there is no extra tool or checked-in binary drift.
//
//   bun scripts/gen-icons.ts
//
// Emits into public/:
//   pwa-192.png, pwa-512.png   — the "any" icons (full-bleed dark square)
//   pwa-maskable-512.png       — same mark inset into the maskable safe zone
//   apple-touch-icon.png       — 180px, iOS home screen

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOM = "#14110E"; // --color-room, the workshop bakelite
const publicDir = join(import.meta.dir, "..", "public");
const svg = readFileSync(join(publicDir, "favicon.svg"), "utf8");

// The two doubled crosses: everything from the first <g> to the last </g>.
const marks = svg.slice(svg.indexOf("<g"), svg.lastIndexOf("</g>") + 4);

// Maskable variant: full-bleed dark square (no rounded corners — the platform
// applies its own mask), the mark scaled into the ~80% safe zone (32 in a 40
// viewBox, centred by the 4-unit inset).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${ROOM}"/><g transform="translate(4,4)">${marks}</g></svg>`;

function png(source: string, size: number): Buffer {
  const resvg = new Resvg(source, {
    fitTo: { mode: "width", value: size },
    background: ROOM, // fill the rounded-rect corners so the icon is opaque
  });
  return resvg.render().asPng();
}

const outputs: [string, string, number][] = [
  ["pwa-192.png", svg, 192],
  ["pwa-512.png", svg, 512],
  ["pwa-maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", svg, 180],
];

for (const [name, source, size] of outputs) {
  writeFileSync(join(publicDir, name), png(source, size));
  console.error(`wrote public/${name} (${size}px)`);
}
