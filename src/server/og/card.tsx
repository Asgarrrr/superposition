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

import { computeStreaks } from "../../lib/streak.ts";
import { distinctions, type Distinction } from "../../lib/distinctions.ts";
import { Stamp } from "../../ui/components/Stamp.tsx";
import { utcDay } from "../../lib/day.ts";
import { instrumentItalic, instrumentRegular } from "./fonts.ts";

const W = 1200;
const H = 630;

const PAPER = "#f2ede4";
const TAPE = "#e8b84b";

const STAMP_W = 198;
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

// One sheet on the lit table, laid out like the profile page it stands for:
// a masthead with the figures ranged right, the series across the middle, and
// the year's grid holding the foot. The card used to be things placed on a black
// rectangle; giving it the page's own sheet is most of what makes it read.
// One sheet on the lit table, composed as a poster rather than as a dashboard:
// the masthead with the figures ranged right on its baseline, and the series
// large across the middle. The year's grid deliberately stays on the PAGE — on a
// card read at thumbnail size it only competed with the stamps, and the "jours"
// figure already carries what it had to say. Giving the stamps that room is what
// finally makes their engravings legible at share size.
function Card({
  name,
  streaks,
  marks,
}: {
  name: string;
  streaks: { current: number; longest: number; total: number };
  marks: Distinction[];
}) {
  const stat = (value: number, label: string, accent = false) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
      }}
    >
      <span
        style={{
          fontSize: 46,
          fontFamily: "Instrument Serif",
          color: accent ? TAPE : PAPER,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 12,
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
        padding: 30,
        background: "#14110e",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          gap: 46,
          padding: "44px 56px",
          borderRadius: 4,
          border: "1px solid rgba(242,237,228,0.10)",
          // satori parses linear-gradient reliably; the page's radial glow came
          // out flat here, and a top-lit ramp reads as the same lit box
          backgroundImage:
            "linear-gradient(180deg, #272119 0%, #1b1713 48%, #17130f 100%)",
          fontFamily: "Instrument Serif",
        }}
      >
        {/* masthead — the name at left, the figures ranged right on its baseline */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 16,
                letterSpacing: 7,
                textTransform: "uppercase",
                color: TAPE,
              }}
            >
              Superposition · Tirages
            </span>
            {/* the name, pulled twice a hair out of register */}
            <div
              style={{ display: "flex", position: "relative", marginTop: 12 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: -3,
                  top: -2,
                  fontSize: 78,
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
                  fontSize: 78,
                  fontStyle: "italic",
                  color: "#ff4fa3",
                }}
              >
                {name}
              </span>
              <span style={{ fontSize: 78, fontStyle: "italic", color: PAPER }}>
                {name}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 46, paddingBottom: 10 }}>
            {stat(streaks.current, "série en cours", true)}
            {stat(streaks.longest, "record")}
            {stat(streaks.total, "jours")}
          </div>
        </div>

        {/* the series, centred across the sheet */}
        <div style={{ display: "flex", justifyContent: "center", gap: 30 }}>
          {marks.map((d) => (
            <img
              key={d.family}
              src={stampImage(d)}
              width={STAMP_W}
              height={STAMP_H}
            />
          ))}
        </div>
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
  const svg = await satori(
    <Card
      name={history.name}
      streaks={streaks}
      marks={distinctions(history.marks)}
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
