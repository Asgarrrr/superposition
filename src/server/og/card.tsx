// Server-only: renders a public profile's Open Graph card to PNG. Kept out of
// the route module's top-level imports (it pulls in the DB, satori, the native
// resvg binary and base64 fonts) and loaded via dynamic import inside the route
// handler, so none of it leaks into the client bundle.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { renderToStaticMarkup } from "react-dom/server";
import { historyByUsername } from "../profileData.ts";
import { buildYear, SHADE_HEX as SHADE } from "../../lib/contribGrid.ts";
import { computeStreaks } from "../../lib/streak.ts";
import { distinctions, type Distinction } from "../../lib/distinctions.ts";
import { Stamp } from "../../ui/components/Stamp.tsx";
import { utcDay } from "../../lib/day.ts";
import { instrumentItalic, instrumentRegular } from "./fonts.ts";

const W = 1200;
const H = 630;

const PAPER = "#f2ede4";
const TAPE = "#e8b84b";

const STAMP_W = 140;
const STAMP_H = Math.round((STAMP_W * 148) / 120);

// Satori draws its OWN text as glyph outlines, so the name and the figures need
// no font at raster time. The stamps do, because they are rasterised separately
// (see below) — and resvg 2.6 takes only font PATHS, no buffers. System fonts
// are not a given in a deploy container, and a missing family renders as
// NOTHING rather than as a fallback. So the two faces this module already
// carries are spilled to a temp file once per process and handed over by path:
// still no network and no repo file read, the bytes come from the bundle
// exactly as they did before.
let fontFiles: string[] | null = null;
function embeddedFontFiles(): string[] {
  if (fontFiles) return fontFiles;
  const dir = mkdtempSync(join(tmpdir(), "superposition-og-"));
  const files = [
    { path: join(dir, "InstrumentSerif-Regular.ttf"), data: instrumentRegular },
    { path: join(dir, "InstrumentSerif-Italic.ttf"), data: instrumentItalic },
  ];
  for (const f of files) writeFileSync(f.path, f.data);
  fontFiles = files.map((f) => f.path);
  return fontFiles;
}

/** One stamp, rasterised on its own and handed to satori as a bitmap.
 *
 *  Satori lays out flexbox, not arbitrary SVG, so the artwork cannot be dropped
 *  into its tree as elements — and it must not be repainted here either, or the
 *  card and the page would drift apart at the first change. So the real
 *  component is serialised and rendered.
 *
 *  It is rendered to PNG rather than passed through as an SVG data URI because
 *  resvg does not draw `<text>` inside a nested SVG image: handed the artwork
 *  that way, every stamp came out with its face value, its labels and its
 *  postmark date missing. Rasterised at the top level the text is resolved
 *  normally, and satori only has to place a picture. Rendered at 3× so the card
 *  stays crisp where crawlers scale it up. */
function stampImage(d: Distinction): string {
  const markup = renderToStaticMarkup(
    <Stamp distinction={d} width={STAMP_W} />,
  );
  const png = new Resvg(markup, {
    fitTo: { mode: "width", value: STAMP_W * 3 },
    font: {
      fontFiles: embeddedFontFiles(),
      defaultFontFamily: "Instrument Serif",
      loadSystemFonts: false,
    },
  })
    .render()
    .asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function Card({
  name,
  streaks,
  marks,
  weeks,
}: {
  name: string;
  streaks: { current: number; longest: number; total: number };
  marks: Distinction[];
  weeks: ReturnType<typeof buildYear>;
}) {
  const stat = (value: number, label: string, accent = false) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 48,
          fontFamily: "Instrument Serif",
          color: accent ? TAPE : PAPER,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 14,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#8a8378",
        }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#14110e",
        fontFamily: "Instrument Serif",
      }}
    >
      {/* masthead */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 18,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: TAPE,
          }}
        >
          Superposition · Tirages
        </span>
        {/* the name, pulled twice a hair out of register */}
        <div style={{ display: "flex", position: "relative", marginTop: 14 }}>
          <span
            style={{
              position: "absolute",
              left: -3,
              top: -2,
              fontSize: 92,
              fontStyle: "italic",
              color: "#45e0ec",
            }}
          >
            {name}
          </span>
          <span
            style={{
              position: "absolute",
              left: 3,
              top: 2,
              fontSize: 92,
              fontStyle: "italic",
              color: "#ff4fa3",
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 92, fontStyle: "italic", color: PAPER }}>
            {name}
          </span>
        </div>
      </div>

      {/* the series, and the figures beside it */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          {marks.map((d) => (
            <img
              key={d.family}
              src={stampImage(d)}
              width={STAMP_W}
              height={STAMP_H}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 52, paddingBottom: 6 }}>
          {stat(streaks.current, "série en cours", true)}
          {stat(streaks.longest, "record")}
          {stat(streaks.total, "jours")}
        </div>
      </div>

      {/* mini contribution grid */}
      <div style={{ display: "flex", gap: 3 }}>
        {weeks.map((col, i) => (
          <div
            key={i}
            style={{ display: "flex", flexDirection: "column", gap: 3 }}
          >
            {col.map((cell, j) => (
              <div
                key={j}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: cell.spacer
                    ? "transparent"
                    : (SHADE[cell.count] ?? TAPE),
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The OG card for a username as a PNG Response, or a 404 when no such account. */
export async function ogResponse(username: string): Promise<Response> {
  const history = await historyByUsername(username);
  if (!history) return new Response("Not found", { status: 404 });

  const today = utcDay();
  const streaks = computeStreaks(
    history.days.map((d) => d.date),
    today,
  );
  // the card is a snapshot: show the current year, GitHub-style
  const weeks = buildYear(history.days, Number(today.slice(0, 4)), today);

  const svg = await satori(
    <Card
      name={history.name}
      streaks={streaks}
      marks={distinctions(history.marks)}
      weeks={weeks}
    />,
    {
      width: W,
      height: H,
      fonts: [
        {
          name: "Instrument Serif",
          data: instrumentRegular,
          weight: 400,
          style: "normal",
        },
        {
          name: "Instrument Serif",
          data: instrumentItalic,
          weight: 400,
          style: "italic",
        },
      ],
    },
  );
  // system lookup off, shipped face as the fallback for every family: the same
  // card comes out of a laptop and out of the deploy container. The cost is that
  // the stamps' small monospaced labels set in the serif here — on the card only,
  // never on the page.
  const png = new Resvg(svg, {
    font: {
      fontFiles: embeddedFontFiles(),
      defaultFontFamily: "Instrument Serif",
      loadSystemFonts: false,
    },
  })
    .render()
    .asPng();
  return new Response(png as unknown as BodyInit, {
    headers: {
      "content-type": "image/png",
      // crawlers re-fetch; a day of CDN caching is plenty for a card whose only
      // volatile input is the streak
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
