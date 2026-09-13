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
import type { Held } from "../../lib/commemoratives.ts";

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

// ─── Sissi ───────────────────────────────────────────────────
// The workshop's cat, loafed across a board. Not an allegory of anything: it is
// what she actually does, which is sit on whatever you are working on. Drawn
// solid grey and white — she is a bicolour, not a tabby, so there is not a
// single stripe on her anywhere.

const CAT = "#55504a";
const CAT_FUR = "#f7f3ec";
const CAT_EAR = "#e2a8ad";
const CAT_NOSE = "#e08a9a";
const CAT_EYE = "#8ca55e";
const CAT_LID = "#e6c2c4";

/** One eye: a wide green ring around a big round pupil, the lid dark only along
 *  the top. Ringing it all round is what made earlier passes read as a cartoon. */
function CatEye() {
  return (
    <g>
      <ellipse rx={4.5} ry={4} fill={CAT_LID} opacity={0.55} />
      <path
        d="M-4.1 0 C-3.9 -3.5 -0.6 -4.4 1.2 -3.4 C3 -2.4 4.1 -1.2 4.1 0 C4.1 2.4 2 3.7 0 3.7 C-2.2 3.7 -4.1 2.3 -4.1 0 Z"
        fill={CAT_EYE}
      />
      <circle r={2.15} fill="#17130f" />
      <circle cx={-0.75} cy={-0.95} r={0.5} fill={CAT_FUR} opacity={0.92} />
      <path
        d="M-4.2 -.6 C-3.9 -3.7 -0.5 -4.7 1.3 -3.6 C3.1 -2.6 4.2 -1.4 4.2 -.3"
        fill="none"
        stroke="#3f3a35"
        strokeWidth={0.95}
        strokeLinecap="round"
      />
      <path
        d="M-4 .8 C-3.2 2.9 -1.6 3.8 0 3.8 C1.8 3.8 3.3 2.9 4 .8"
        fill="none"
        stroke="#8d8579"
        strokeWidth={0.55}
        strokeLinecap="round"
        opacity={0.85}
      />
    </g>
  );
}

const SKULL =
  "M0 -13.5 C9 -13.5 14 -7 14 0 C14 8 8 13 0 13 C-8 13 -14 8 -14 0 C-14 -7 -9 -13.5 0 -13.5 Z";

/** Her head. The markings are the likeness: a grey cap that comes down to a
 *  POINT between the eyes, split by a white blaze running up to the right ear —
 *  not a left/right split, which is what several earlier passes drew. */
function CatHead() {
  return (
    <g>
      <clipPath id="sissi-skull">
        <path d={SKULL} />
      </clipPath>

      <path
        d="M-13.5 -6 L-11.5 -19.5 L-1.5 -12.5 Z"
        fill={CAT}
        stroke={CAT}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <path d="M-11.4 -7.8 L-10.2 -16.6 L-4 -12z" fill={CAT_EAR} opacity={0.85} />
      <path
        d="M13.5 -6 L11.5 -19.5 L1.5 -12.5 Z"
        fill={CAT_FUR}
        stroke={CAT}
        strokeWidth={1.15}
        strokeLinejoin="round"
      />
      <path d="M11.4 -7.8 L10.2 -16.6 L4 -12z" fill={CAT_EAR} opacity={0.7} />
      <path d="M13.5 -6 L11.5 -19.5 L8.4 -16.8z" fill={CAT} opacity={0.5} />
      <g stroke={CAT_FUR} strokeWidth={0.8} strokeLinecap="round">
        <path d="M-9.8 -9 l-1.8 -3.2M-7.4 -10.2 l-1.2 -3.4" />
      </g>
      <g stroke="#c9c2b6" strokeWidth={0.75} strokeLinecap="round">
        <path d="M9.8 -9 l1.8 -3.2M7.4 -10.2 l1.2 -3.4" />
      </g>

      <path d={SKULL} fill={CAT_FUR} stroke={CAT} strokeWidth={1.2} />

      <g clipPath="url(#sissi-skull)">
        <path
          d="M-22 -22 L22 -22 L22 -7.6 C16 -7.4 11 -6.6 7 -5.6 C4 -4.8 1.4 -3.8 -1.4 -3.1 C-3.4 -3.9 -5.6 -4.8 -8 -5.4 C-10.2 -6 -11.6 -4.4 -12.2 -1.6 C-12.8 1.6 -12.4 5.2 -11.4 8.4 L-22 12 Z"
          fill={CAT}
          opacity={0.52}
        />
        <path
          d="M-0.6 -3.2 C1.4 -6 3.6 -9 5.6 -12 C6.8 -13.8 7.6 -15.6 8 -17.4 L13.6 -17.4 C13 -13.6 11.4 -10 9 -7.4 C7 -5.2 4 -3.8 0.8 -3.0 Z"
          fill={CAT_FUR}
        />
      </g>

      <g transform="translate(-6.2,-1.2)">
        <CatEye />
      </g>
      <g transform="translate(6.2,-1.2) scale(-1,1)">
        <CatEye />
      </g>

      <path
        d="M-2.3 4.6 L2.3 4.6 L0 7.1 Z"
        fill={CAT_NOSE}
        stroke="#c4707f"
        strokeWidth={0.5}
      />
      <g fill="none" stroke={CAT} strokeLinecap="round">
        <path d="M0 7.1 V8.6" strokeWidth={0.9} />
        <path d="M0 8.6 C-1.4 10.7 -4.4 10.5 -5.2 8.3" strokeWidth={0.95} />
        <path d="M0 8.6 C1.4 10.7 4.4 10.5 5.2 8.3" strokeWidth={0.95} />
      </g>
      <g fill={CAT} opacity={0.34}>
        <circle cx={-4.4} cy={5.9} r={0.36} />
        <circle cx={-6.2} cy={7} r={0.36} />
        <circle cx={4.4} cy={5.9} r={0.36} />
        <circle cx={6.2} cy={7} r={0.36} />
      </g>
      <g stroke={CAT} strokeWidth={0.45} opacity={0.38} strokeLinecap="round">
        <path d="M-8 5.2 C-13.4 3.2 -18 2.6 -21.6 3" />
        <path d="M-8.2 6.8 C-13.8 6 -18.6 6.4 -21.8 7.6" />
        <path d="M-7.8 8.4 C-13 8.8 -17.2 10.4 -20 12.4" />
        <path d="M8 5.2 C13.4 3.2 18 2.6 21.6 3" />
        <path d="M8.2 6.8 C13.8 6 18.6 6.4 21.8 7.6" />
        <path d="M7.8 8.4 C13 8.8 17.2 10.4 20 12.4" />
      </g>
    </g>
  );
}

/** The board she is lying on: 5 × 5 SQUARE cells, because the game's board is
 *  square. An earlier pass stretched it to 13.6 × 10 and it read as wrong. */
function SissiPlate() {
  return (
    <g>
      <g stroke={CAT} fill="none" strokeWidth={0.75} opacity={0.3}>
        <path d="M30 36h60M30 48h60M30 60h60M30 72h60M30 84h60M30 96h60M30 36v60M42 36v60M54 36v60M66 36v60M78 36v60M90 36v60" />
      </g>
      {/* the two inks, on a square she has not taken yet */}
      <Fusion x={36.25} y={90} r={3.5} />

      <path
        d="M82 84 C92 84.5 94.5 76.5 90.5 71"
        fill="none"
        stroke={CAT}
        strokeWidth={4.4}
        strokeLinecap="round"
        opacity={0.92}
      />
      <path
        d="M36 89 C32.4 82.6 34.8 72.4 42.8 66.8 C50.6 61.4 63.6 60.8 72 65.4 C81 70.4 84 80 81 86.8 C79.6 89.8 75.6 90.8 70.6 90.8 L43.2 90.8 C39.4 90.8 37 90.2 36 89 Z"
        fill={CAT}
        opacity={0.3}
      />
      <path
        d="M36 89 C32.4 82.6 34.8 72.4 42.8 66.8 C50.6 61.4 63.6 60.8 72 65.4 C81 70.4 84 80 81 86.8 C79.6 89.8 75.6 90.8 70.6 90.8 L43.2 90.8 C39.4 90.8 37 90.2 36 89 Z"
        fill="none"
        stroke={CAT}
        strokeWidth={1.3}
      />
      <path
        d="M40.4 89 C37.4 82.6 39.5 74.6 46.4 69.8 C52.4 65.6 59.5 64.4 64.3 65.4 C58.2 72.4 53.4 81.4 52.4 90.8 L44.2 90.8 C41.9 90.8 41 90.2 40.4 89 Z"
        fill={CAT_FUR}
      />
      <g fill={CAT_FUR} stroke={CAT} strokeWidth={1}>
        <path d="M42.8 86 h8.9 a2.85 2.85 0 0 1 0 4.9 h-8.9 a2.45 2.45 0 0 1 0 -4.9 z" />
        <path d="M53.8 86 h8.9 a2.85 2.85 0 0 1 0 4.9 h-8.9 a2.45 2.45 0 0 1 0 -4.9 z" />
      </g>
      <g stroke={CAT} strokeWidth={0.55} opacity={0.45} strokeLinecap="round">
        <path d="M45.8 87.7 v2.6M48.7 87.7 v2.6M56.8 87.7 v2.6M59.7 87.7 v2.6" />
      </g>
      <g transform="translate(51,59.5) scale(.84)">
        <CatHead />
      </g>
    </g>
  );
}

// ─── The sheet ───────────────────────────────────────────────

const W = 120;
const H = 148;

/** The stamp itself, minus its subject: perforation, paper, burelage, frame,
 *  issuer, footer band and cancellation. Shared so a commemorative and a series
 *  value are the same object with a different engraving in the middle. */
function Sheet({
  uid,
  ink,
  width,
  label,
  face,
  alt,
  mark,
  thickInner = false,
  children,
}: {
  uid: string;
  ink: string;
  width: number;
  label: string;
  face: string;
  alt: string;
  mark: { day: string; year: string } | null;
  thickInner?: boolean;
  children: React.ReactNode;
}) {
  const height = Math.round((width * H) / W);
  // a four-figure value needs a wider cartouche than "5" does
  const wide = face.length > 3;
  const cartoucheX = wide ? 70 : 76;
  const cartoucheW = wide ? 32 : 26;

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
          strokeWidth={thickInner ? 1.1 : 0.6}
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

        {children}

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
          {label}
        </text>
        <rect x={cartoucheX} y={106} width={cartoucheW} height={19} fill={ink} />
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

// ─── The two kinds of stamp ──────────────────────────────────

export function Stamp({
  distinction: d,
  width = 116,
}: {
  distinction: Distinction;
  width?: number;
}) {
  const name = FAMILY_NAME[d.family]();

  // an unopened family: the empty album mount, with what it takes written in
  if (d.tier === 0) {
    const height = Math.round((width * H) / W);
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

  return (
    <Sheet
      uid={`st-${d.family}`}
      ink={INK[d.family]}
      width={width}
      label={FAMILY_LABEL[d.family]()}
      face={String(d.threshold)}
      thickInner={d.next === null}
      mark={d.earnedOn ? postmark(d.earnedOn) : null}
      alt={m.profile_stamp_earned({
        family: name,
        threshold: d.threshold ?? 0,
        date: d.earnedOn ?? "",
      })}
    >
      <Engraving d={d} ink={INK[d.family]} />
    </Sheet>
  );
}

/** A hors-série. It carries no face value to climb, so its cartouche reads
 *  "H.S." — the philatelic mark for an issue outside the current series. */
export function CommemorativeStamp({
  held,
  width = 116,
}: {
  held: Held;
  width?: number;
}) {
  const name = m.profile_stamp_sissi();
  return (
    <Sheet
      uid={`hs-${held.key}`}
      ink={CAT}
      width={width}
      label={name.toUpperCase()}
      face="H.S."
      mark={postmark(held.earnedOn)}
      alt={m.profile_stamp_commemorative({ name, date: held.earnedOn })}
    >
      <SissiPlate />
    </Sheet>
  );
}
