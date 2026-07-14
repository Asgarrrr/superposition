// A registration cross — the sheet's two films, doubled cyan/magenta and
// slightly off, in `screen` blend. Frames the light table at each corner.

export function RegCross({ pos }: { pos: string }) {
  const arm = (color: string, dx: number, dy: number) => (
    <g transform={`translate(${11 + dx},${12 + dy})`}>
      <line x1="-7.5" y1="0" x2="7.5" y2="0" stroke={color} strokeWidth="1.2" />
      <line x1="0" y1="-7.5" x2="0" y2="7.5" stroke={color} strokeWidth="1.2" />
      <circle r="4.2" fill="none" stroke={color} strokeWidth="1.2" />
    </g>
  );
  return (
    <svg
      width="26"
      height="27"
      viewBox="0 0 26 27"
      className={`absolute ${pos}`}
      style={{ opacity: 0.6 }}
    >
      <g style={{ mixBlendMode: "screen" }}>
        {arm("var(--color-ink-cyan)", 0, 0)}
        {arm("var(--color-ink-magenta)", 3, 2)}
      </g>
    </svg>
  );
}
