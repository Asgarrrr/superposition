// One stamp of the profile's series: a distinction printed as a postage stamp —
// cream paper on the dark table, perforated, burelage under the engraving, the
// face value in its corner cartouche, and a postmark dated to the day the tier
// was crossed. A family the player has not opened prints as an EMPTY ALBUM
// MOUNT: the dashed frame where the missing stamp would be hinged, with the
// condition written inside. That is the whole vocabulary — a collection page is
// stamps and empty mounts, nothing else.
//
// Presentational and total: it draws whatever `Distinction` it is handed and
// owns no rule. Thresholds, tiers and postmark dates all come from
// lib/distinctions.ts. This is also the ONLY place the artwork lives — the OG
// card renders these same shapes rather than painting a second version.

import { m } from "../../paraglide/messages.js";
import type { Distinction, Family } from "../../lib/distinctions.ts";

// One plate colour per family. The four stamps carry four different engravings,
// so it is the FAMILY that needs telling apart at a glance; the tier is read off
// the face value, the only thing that changes between two values of a series.
// Rarity's violet exists nowhere else in the game — the one family that speaks
// of exception is the one wearing a colour of exception.
const INK: Record<Family, string> = {
  regularite: "#a81a5c",
  maitrise: "#17737d",
  rarete: "#6b4fa8",
  edition: "#9a6d11",
};

// The two inks, painted explicitly rather than blended: `mix-blend-mode` reacts
// to whatever is behind it (cyan went green over the gold plate) and satori
// cannot render it for the OG card. The lens is the colour two superposed inks
// actually make.
const CYAN = "#2bb8c4";
const MAGENTA = "#e82d86";
const LENS = "#272067";

const FAMILY_NAME: Record<Family, () => string> = {
  regularite: m.profile_stamp_regularite,
  maitrise: m.profile_stamp_maitrise,
  rarete: m.profile_stamp_rarete,
  edition: m.profile_stamp_edition,
};

const FAMILY_LABEL: Record<Family, () => string> = {
  regularite: m.profile_stamp_label_regularite,
  maitrise: m.profile_stamp_label_maitrise,
  rarete: m.profile_stamp_label_rarete,
  edition: m.profile_stamp_label_edition,
};

const ROMAN = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
] as const;

/** A postmark reads its month in roman numerals, the way a real canceller does.
 *  Deliberately not `Intl` — the mark is typographic, not localised. */
function postmark(date: string): { day: string; year: string } {
  const [y, mo, d] = date.split("-");
  return { day: `${Number(d)}·${ROMAN[Number(mo) - 1]}`, year: y! };
}

/** The two pawns superposed — the win, and the game's signature. */
function Fusion({ x, y, r = 5.4 }: { x: number; y: number; r?: number }) {
  const dx = r * 0.63;
  const id = `lens-${x}-${y}-${r}`;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={-dx} cy={0} r={r} fill={CYAN} />
      <circle cx={dx} cy={0} r={r} fill={MAGENTA} />
      <clipPath id={id}>
        <circle cx={dx} cy={0} r={r} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <circle cx={-dx} cy={0} r={r} fill={LENS} />
      </g>
    </g>
  );
}

// ─── The four engravings ─────────────────────────────────────
// Each one pictures the ACT, never an allegory of it: none needs a caption.

/** A calendar with no gap in it — the contribution grid, in miniature. */
function CalendarPlate({ ink, count }: { ink: string; count: number }) {
  // the run fills the sheet up to its last day, and that last day is printed in
  // BOTH inks — the game's signature has to survive a full calendar, so the
  // fusion cell is carved out of the run rather than placed after it
  const last = Math.min(count, 28) - 1;
  const cells = Array.from({ length: 28 }, (_, i) => ({
    x: 23.5 + (i % 7) * 11,
    y: 40 + Math.floor(i / 7) * 9,
    filled: i < last,
  }));
  return (
    <g>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={8}
          height={6.4}
          rx={1}
          fill={c.filled ? ink : "none"}
          stroke={c.filled ? "none" : ink}
          strokeWidth={0.7}
          opacity={c.filled ? 1 : 0.4}
        />
      ))}
      {last >= 0 && (
        <Fusion x={cells[last]!.x + 4} y={cells[last]!.y + 3.2} r={3.6} />
      )}
    </g>
  );
}

/** The board, the shortest path drawn on it, the two pawns superposed at the
 *  end — a win at the solver's optimum, exactly as it looks. */
function BoardPlate({ ink }: { ink: string }) {
  return (
    <g>
      <g stroke={ink} fill="none" strokeWidth={0.7} opacity={0.32}>
        <path d="M32 40h55M32 51h55M32 62h55M32 73h55M32 84h55M32 95h55M32 40v55M43 40v55M54 40v55M65 40v55M76 40v55M87 40v55" />
      </g>
      {/* one route across the whole board, two turns — long legs read as a path,
          short ones read as plumbing */}
      <path
        d="M37.5 89.5 H59.5 V67.5 H70.5"
        fill="none"
        stroke={ink}
        strokeWidth={2.3}
        opacity={1}
        strokeDasharray="3.4 2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x={34.5}
        y={86.5}
        width={6}
        height={6}
        rx={1}
        fill={ink}
        opacity={0.8}
      />
      <Fusion x={70.5} y={67.5} r={6} />
    </g>
  );
}

/** The weekend 6×6, peopled with walls and mirrors. It is the DENSITY that says
 *  "hard", not the size alone — an empty larger grid says nothing. */
function WideBoardPlate({ ink }: { ink: string }) {
  // laid out so the board reads as designed rather than sprinkled: the walls sit
  // on a loose diagonal symmetry, which is what a hand-authored board looks like
  const walls = [
    [40, 38],
    [70, 38],
    [30, 58],
    [80, 58],
    [50, 88],
    [70, 88],
  ] as const;
  return (
    <g>
      <g stroke={ink} fill="none" strokeWidth={0.7} opacity={0.3}>
        <path d="M30 38h60M30 48h60M30 58h60M30 68h60M30 78h60M30 88h60M30 98h60M30 38v60M40 38v60M50 38v60M60 38v60M70 38v60M80 38v60M90 38v60" />
      </g>
      <g fill={ink} opacity={0.55}>
        {walls.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={10} height={10} />
        ))}
      </g>
      {/* the glaces, drawn corner to corner inside their cell so they read as
          mirrors and not as stray slashes */}
      <g stroke={ink} strokeWidth={1.8} opacity={0.75} strokeLinecap="round">
        <path d="M51 49l8 8M71 69l8 8M41 79l8 8" />
      </g>
      <Fusion x={65} y={68} r={6} />
      {/* the size, spelled — it is what separates this board from the 5×5 on the
          stamp next to it, and the two are only ever seen side by side */}
      <text
        x={30}
        y={104}
        fill={ink}
        opacity={0.8}
        fontFamily="Instrument Serif, Georgia, serif"
        fontStyle="italic"
        fontSize={10}
      >
        6 × 6
      </text>
    </g>
  );
}

/** The 22 plates laid out by chapter and centred, the way the edition screen
 *  ranks them. Rows are the real chapter sizes, so the shape is the game's. */
const CHAPTERS = [5, 3, 2, 2, 2, 2, 3, 3] as const;

function EditionPlate({ ink, count }: { ink: string; count: number }) {
  const cells: { x: number; y: number; filled: boolean }[] = [];
  let n = 0;
  CHAPTERS.forEach((size, row) => {
    const width = size * 11 - 2;
    const x0 = 60 - width / 2;
    for (let i = 0; i < size; i++) {
      cells.push({ x: x0 + i * 11, y: 37 + row * 9, filled: n < count });
      n++;
    }
  });
  return (
    <g>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={9}
          height={6}
          rx={1}
          fill={c.filled ? ink : "none"}
          stroke={c.filled ? "none" : ink}
          strokeWidth={0.8}
          opacity={c.filled ? 1 : 0.5}
        />
      ))}
      <Fusion x={53.5} y={40} r={2.6} />
    </g>
  );
}

function Engraving({ d, ink }: { d: Distinction; ink: string }) {
  switch (d.family) {
    case "regularite":
      return <CalendarPlate ink={ink} count={d.count} />;
    case "maitrise":
      return <BoardPlate ink={ink} />;
    case "rarete":
      return <WideBoardPlate ink={ink} />;
    case "edition":
      return <EditionPlate ink={ink} count={d.count} />;
  }
}

// ─── The stamp ───────────────────────────────────────────────

const W = 120;
const H = 148;

export function Stamp({
  distinction: d,
  width = 116,
}: {
  distinction: Distinction;
  width?: number;
}) {
  const height = Math.round((width * H) / W);
  const name = FAMILY_NAME[d.family]();

  // an unopened family: the empty album mount, with what it takes written in
  if (d.tier === 0) {
    const goal = d.next === null ? "" : m.profile_stamp_goal({ next: d.next });
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${name} — ${goal}`}
      >
        <title>{`${name} — ${goal}`}</title>
        <rect
          x={8}
          y={8}
          width={104}
          height={132}
          rx={2}
          fill="rgba(242,237,228,.02)"
          stroke="rgba(242,237,228,.16)"
          strokeWidth={1.4}
          strokeDasharray="4 4"
        />
        <g fill="none" stroke="rgba(242,237,228,.13)" strokeWidth={1.2}>
          <path d="M22 22h10M22 22v10M98 22H88M98 22v10M22 126h10M22 126v-10M98 126H88M98 126v-10" />
        </g>
        <text
          x={60}
          y={68}
          textAnchor="middle"
          fill="rgba(242,237,228,.30)"
          fontFamily="Instrument Serif, Georgia, serif"
          fontStyle="italic"
          fontSize={15}
        >
          {m.profile_stamp_pending()}
        </text>
        <text
          x={60}
          y={86}
          textAnchor="middle"
          fill="rgba(242,237,228,.22)"
          fontFamily="ui-monospace, Menlo, monospace"
          fontSize={6.5}
          letterSpacing={1.6}
        >
          {goal.toUpperCase()}
        </text>
      </svg>
    );
  }

  const ink = INK[d.family];
  const uid = `st-${d.family}`;
  const face = String(d.threshold);
  // a four-figure value needs a wider cartouche than "5" does
  const wide = face.length > 3;
  const cartoucheX = wide ? 70 : 76;
  const cartoucheW = wide ? 32 : 26;
  const mark = d.earnedOn ? postmark(d.earnedOn) : null;
  const alt = m.profile_stamp_earned({
    family: name,
    threshold: d.threshold ?? 0,
    date: d.earnedOn ?? "",
  });

  return (
    // xmlns is redundant in the DOM but required once this same markup is
    // serialised standalone into the OG card's data URI
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={alt}
    >
      <title>{alt}</title>
      <defs>
        {/* the perforation: the perimeter is 2×(104+132) = 472, and a pitch of
            8 divides it exactly 59 times, so the teeth meet cleanly at the
            corner where the dash pattern restarts */}
        <mask id={`${uid}-perf`}>
          <rect x={8} y={8} width={104} height={132} fill="#fff" />
          <rect
            x={8}
            y={8}
            width={104}
            height={132}
            fill="none"
            stroke="#000"
            strokeWidth={6.4}
            strokeDasharray="0.1 8"
            strokeLinecap="round"
          />
        </mask>
        <linearGradient id={`${uid}-paper`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#f7f3ec" />
          <stop offset="48%" stopColor="#f0e9dd" />
          <stop offset="100%" stopColor="#e3d9c7" />
        </linearGradient>
        {/* burelage: the wavy ground engraved under every real stamp — and, here,
            a halftone by another name */}
        <pattern
          id={`${uid}-burelage`}
          width={6}
          height={3}
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 1.5q1.5-1.5 3 0t3 0"
            fill="none"
            stroke="#17130f"
            strokeWidth={0.45}
            opacity={0.16}
          />
        </pattern>
        <filter id={`${uid}-lift`} x="-30%" y="-30%" width="170%" height="175%">
          <feDropShadow
            dx="1.5"
            dy="5"
            stdDeviation="4.5"
            floodColor="#000"
            floodOpacity="0.6"
          />
        </filter>
      </defs>

      <g filter={`url(#${uid}-lift)`}>
        <g mask={`url(#${uid}-perf)`}>
          <rect
            x={8}
            y={8}
            width={104}
            height={132}
            fill={`url(#${uid}-paper)`}
          />
          <rect
            x={8}
            y={8}
            width={104}
            height={132}
            fill={`url(#${uid}-burelage)`}
          />
        </g>

        {/* frame — the top value thickens the inner rule, the only difference
            between two values of one series besides the figure itself */}
        <rect
          x={15}
          y={15}
          width={90}
          height={118}
          fill="none"
          stroke={ink}
          strokeWidth={1.5}
          opacity={0.9}
        />
        <rect
          x={18}
          y={18}
          width={84}
          height={112}
          fill="none"
          stroke={ink}
          strokeWidth={d.next === null ? 1.1 : 0.6}
          opacity={0.45}
        />

        <text
          x={60}
          y={28}
          textAnchor="middle"
          fill={ink}
          opacity={0.85}
          fontFamily="ui-monospace, Menlo, monospace"
          fontSize={6}
          letterSpacing={2.4}
        >
          SUPERPOSITION
        </text>

        <Engraving d={d} ink={ink} />

        {/* footer band: label left, face value right — they can never collide */}
        <text
          x={21}
          y={121}
          fill={ink}
          opacity={0.9}
          fontFamily="ui-monospace, Menlo, monospace"
          fontSize={6}
          letterSpacing={1.4}
        >
          {FAMILY_LABEL[d.family]()}
        </text>
        <rect
          x={cartoucheX}
          y={106}
          width={cartoucheW}
          height={19}
          fill={ink}
        />
        <text
          x={cartoucheX + cartoucheW / 2}
          y={120}
          textAnchor="middle"
          fill="#f7f3ec"
          fontFamily="Instrument Serif, Georgia, serif"
          fontStyle="italic"
          fontSize={wide ? 14 : 15}
        >
          {face}
        </text>

        {/* the cancellation, landing on the engraving the way a real one does —
            never on the issuer's name */}
        {mark && (
          <g transform="translate(89,45) rotate(-16)" opacity={0.5}>
            {/* the strike knocks the paper back before the rings land, so the
                date reads over the engraving instead of tangling with it */}
            <circle r={19.5} fill="#f0e9dd" opacity={0.62} />
            <circle r={19.5} fill="none" stroke="#17130f" strokeWidth={1.7} />
            <circle r={14.5} fill="none" stroke="#17130f" strokeWidth={0.8} />
            <text
              y={0.5}
              textAnchor="middle"
              fill="#17130f"
              fontFamily="ui-monospace, Menlo, monospace"
              fontSize={8.2}
            >
              {mark.day}
            </text>
            <text
              y={9}
              textAnchor="middle"
              fill="#17130f"
              fontFamily="ui-monospace, Menlo, monospace"
              fontSize={7}
            >
              {mark.year}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
