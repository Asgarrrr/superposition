// A registration pin (goupille de calage) fixed to the GLASS — a calage anchor
// the two films seat onto. Board-absolute: it never rides the world offset. The
// cyan film sits in board coordinates, the magenta film drifts by `off`, so the
// pin shows a small doubled tick that separates with the offset and seats to a
// single head when the worlds align (or fuse). Deliberately quieter and smaller
// than the corner RegMark and the goals, so it reads as an anchor, not a target.

export function RegPin({
  x,
  y,
  offPx,
  merged,
  locked,
}: {
  x: number;
  y: number;
  offPx: [number, number]; // magenta film displacement, px (= corner marks')
  merged: boolean;
  locked: boolean;
}) {
  // a short crosshair — half the corner mark's arm, thinner
  const tick = (color: string, opacity: number) => (
    <g opacity={opacity}>
      <line x1="-4.5" y1="0" x2="4.5" y2="0" stroke={color} strokeWidth="1" />
      <line x1="0" y1="-4.5" x2="0" y2="4.5" stroke={color} strokeWidth="1" />
    </g>
  );
  const seated = locked ? "var(--color-tape)" : "var(--color-paper)";
  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.5}>
      {/* the pin collar seated on the glass */}
      <circle
        r="6.5"
        fill="none"
        stroke={seated}
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      {merged || locked ? (
        tick(seated, 0.9)
      ) : (
        <>
          {tick("var(--color-ink-cyan)", 0.75)}
          <g
            style={{
              transform: `translate(${offPx[0]}px, ${offPx[1]}px)`,
              transition: "transform 350ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            {tick("var(--color-ink-magenta)", 0.75)}
          </g>
        </>
      )}
      {/* the pin head */}
      <circle r="1.6" fill={seated} />
    </g>
  );
}
