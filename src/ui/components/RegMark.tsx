// Registration marks — the signature element. Doubled cyan/magenta,
// their misalignment visualizes the real offset of the worlds; they
// turn white on merge and lock into amber on the
// "ready to print". Always wired to the game state.

export function RegMark({ x, y, offPx, merged, locked }: {
  x: number
  y: number
  offPx: [number, number]
  merged: boolean
  locked: boolean
}) {
  const cross = (color: string, opacity: number) => (
    <g opacity={opacity}>
      <line x1="-7" y1="0" x2="7" y2="0" stroke={color} strokeWidth="1.2" />
      <line x1="0" y1="-7" x2="0" y2="7" stroke={color} strokeWidth="1.2" />
      <circle r="4.2" fill="none" stroke={color} strokeWidth="1.2" />
    </g>
  )
  return (
    <g transform={`translate(${x}, ${y})`}>
      {locked ? (
        cross('var(--color-tape)', 1)
      ) : merged ? (
        cross('var(--color-paper)', 0.9)
      ) : (
        <>
          {cross('var(--color-ink-cyan)', 0.85)}
          <g
            style={{
              transform: `translate(${offPx[0]}px, ${offPx[1]}px)`,
              transition: 'transform 350ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            {cross('var(--color-ink-magenta)', 0.85)}
          </g>
        </>
      )}
    </g>
  )
}
