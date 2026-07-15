// The light box: two ink films, the white overlay (light squares,
// registration marks, merge bloom) and the recoil when a move
// is blocked. Receives the state, decides nothing.

import type { GameState, Level, Pos } from "../../engine/types.ts";
import { sub } from "../../engine/grid.ts";
import type { Pulse } from "../hooks/useGame.ts";
import { boardSpan, CELL, cellCenter } from "./board-metrics.ts";
import { InkLayer } from "./InkLayer.tsx";
import { RegMark } from "./RegMark.tsx";

const bumpName = (d: Pos) =>
  d[0] === -1
    ? "sp-bump-U"
    : d[0] === 1
      ? "sp-bump-D"
      : d[1] === -1
        ? "sp-bump-L"
        : "sp-bump-R";

export function Board({
  level,
  st,
  solved,
  bump,
  bloom,
  iceTrailA,
  iceTrailB,
  onTouchStart,
  onTouchEnd,
  children,
}: {
  level: Level;
  st: GameState;
  solved: boolean;
  bump: Pulse | null;
  bloom: Pulse | null;
  iceTrailA: { from: Pos } | null;
  iceTrailB: { from: Pos } | null;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  children?: React.ReactNode;
}) {
  const span = boardSpan(level.size);
  const pa = st.merged ? st.m : st.a;
  const pbBoard: Pos = st.merged ? sub(st.m, st.off) : st.b;
  const offPx: [number, number] = [st.off[1] * 5, st.off[0] * 5];
  const aligned = solved || st.merged;
  const marks: [number, number][] = [
    [13, 13],
    [span - 13, 13],
    [13, span - 13],
    [span - 13, span - 13],
  ];

  return (
    <div
      key={bump ? bump.t : "steady"}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative aspect-square w-[min(92vw,520px)] overflow-hidden rounded-md"
      style={{
        background:
          "radial-gradient(ellipse 80% 80% at 50% 50%, var(--color-box-glow), var(--color-box) 80%)",
        boxShadow: st.merged
          ? "inset 0 0 90px rgba(242,237,228,0.06), 0 12px 40px rgba(0,0,0,0.5)"
          : "inset 0 0 70px rgba(69,224,236,0.04), inset 0 0 70px rgba(255,79,163,0.04), 0 12px 40px rgba(0,0,0,0.5)",
        transition: "box-shadow 500ms",
        animation: bump ? `${bumpName(bump.payload)} 220ms ease-out` : "none",
      }}
    >
      <InkLayer
        color="var(--color-ink-cyan)"
        pawn={pa}
        goal={level.a.goal}
        walls={level.a.walls}
        misreg={4}
        aligned={aligned}
        size={level.size}
        shift={[0, 0]}
        iceTrail={iceTrailA}
      />
      <InkLayer
        color="var(--color-ink-magenta)"
        pawn={pbBoard}
        goal={level.b.goal}
        walls={level.b.walls}
        misreg={-4}
        aligned={aligned}
        size={level.size}
        shift={st.off}
        iceTrail={iceTrailB}
      />

      <svg
        viewBox={`0 0 ${span} ${span}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {(level.lightWalls ?? []).map(([r, c]) => {
          const [x, y] = cellCenter([r, c]);
          return (
            <g
              key={`${r}-${c}`}
              opacity={st.merged ? 1 : 0.4}
              style={{ transition: "opacity 400ms" }}
            >
              <rect
                x={x - CELL / 2 + 8}
                y={y - CELL / 2 + 8}
                width={CELL - 16}
                height={CELL - 16}
                fill="none"
                stroke="var(--color-paper)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <circle cx={x} cy={y} r="3" fill="var(--color-paper)" />
            </g>
          );
        })}
        {marks.map(([x, y]) => (
          <RegMark
            key={`${x}-${y}`}
            x={x}
            y={y}
            offPx={offPx}
            merged={st.merged}
            locked={solved}
          />
        ))}
        {bloom && (
          <circle
            cx={cellCenter(bloom.payload)[0]}
            cy={cellCenter(bloom.payload)[1]}
            r={CELL * 0.5}
            fill="none"
            stroke="var(--color-paper)"
            strokeWidth="2"
            style={{
              animation: "sp-bloom 550ms ease-out forwards",
              transformOrigin: `${cellCenter(bloom.payload)[0]}px ${cellCenter(bloom.payload)[1]}px`,
            }}
          />
        )}
      </svg>

      {children}
    </div>
  );
}
