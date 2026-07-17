// Server-only: renders a public profile's Open Graph card to PNG. Kept out of
// the route module's top-level imports (it pulls in the DB, satori, the native
// resvg binary and base64 fonts) and loaded via dynamic import inside the route
// handler, so none of it leaks into the client bundle.

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { historyByUsername } from "../profileData.ts";
import { buildYear } from "../../lib/contribGrid.ts";
import { computeStreaks } from "../../lib/streak.ts";
import { utcDay } from "../../lib/day.ts";
import { instrumentItalic, instrumentRegular } from "./fonts.ts";

const W = 1200;
const H = 630;

// the on-screen ramp, pre-blended to opaque hex for the flat card (satori has no
// alpha-over-background); index by tiers solved, 4 = the amber "done" lock
const SHADE = ["#2a2620", "#4a453c", "#7d766a", "#b8b0a2", "#e8b84b"];
const PAPER = "#f2ede4";
const TAPE = "#e8b84b";

function Card({
  name,
  streaks,
  weeks,
}: {
  name: string;
  streaks: { current: number; longest: number; total: number };
  weeks: ReturnType<typeof buildYear>;
}) {
  const stat = (value: number, label: string, accent = false) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 60,
          fontFamily: "Instrument Serif",
          color: accent ? TAPE : PAPER,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 17,
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
        padding: 72,
        background: "#14110e",
        fontFamily: "Instrument Serif",
      }}
    >
      {/* masthead */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 20,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: TAPE,
          }}
        >
          Superposition · Tirages
        </span>
        {/* the name, pulled twice a hair out of register */}
        <div style={{ display: "flex", position: "relative", marginTop: 18 }}>
          <span
            style={{
              position: "absolute",
              left: -3,
              top: -2,
              fontSize: 128,
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
              fontSize: 128,
              fontStyle: "italic",
              color: "#ff4fa3",
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 128, fontStyle: "italic", color: PAPER }}>
            {name}
          </span>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: "flex", gap: 80 }}>
        {stat(streaks.current, "série en cours", true)}
        {stat(streaks.longest, "record")}
        {stat(streaks.total, "jours")}
      </div>

      {/* mini contribution grid */}
      <div style={{ display: "flex", gap: 4 }}>
        {weeks.map((col, i) => (
          <div
            key={i}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            {col.map((cell, j) => (
              <div
                key={j}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
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
    <Card name={history.name} streaks={streaks} weeks={weeks} />,
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
  const png = new Resvg(svg).render().asPng();
  return new Response(png as unknown as BodyInit, {
    headers: {
      "content-type": "image/png",
      // crawlers re-fetch; a day of CDN caching is plenty for a card whose only
      // volatile input is the streak
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
