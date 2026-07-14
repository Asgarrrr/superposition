// The wordmark printed twice, mis-registered: cyan and magenta
// overlap in `screen` blend and align when `aligned` becomes true.

export function Wordmark({
  size = 44,
  aligned = false,
  spread = 1,
}: {
  size?: number | string;
  aligned?: boolean;
  spread?: number; // scales the mis-registration offset (hero uses a wider one)
}) {
  const layer = (
    color: string,
    dx: number,
    dy: number,
  ): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    color,
    mixBlendMode: "screen",
    transform: aligned
      ? "translate(0,0)"
      : `translate(${dx * spread}px,${dy * spread}px)`,
    transition: "transform 900ms cubic-bezier(0.22,1,0.36,1)",
  });
  return (
    <div
      className="relative font-display italic"
      style={{ fontSize: size, lineHeight: 1, letterSpacing: "0.06em" }}
    >
      <span style={layer("var(--color-ink-cyan)", -2.5, -1.5)}>
        Superposition
      </span>
      <span style={layer("var(--color-ink-magenta)", 2.5, 1.5)}>
        Superposition
      </span>
      <span className="invisible">Superposition</span>
    </div>
  );
}
