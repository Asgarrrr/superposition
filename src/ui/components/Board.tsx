// The light box: two ink films, the white overlay (light squares,
// registration marks, merge bloom) and the recoil when a move
// is blocked. Receives the state, decides nothing.

import { useEffect } from "react";
import { motion, useAnimationControls } from "motion/react";
import type { GameState, Level, Pos } from "../../engine/types.ts";
import { sub } from "../../engine/grid.ts";
import type { Pulse } from "../hooks/useGame.ts";
import { boardSpan, CELL, cellCenter } from "./board-metrics.ts";
import { InkLayer } from "./InkLayer.tsx";
import { RegMark } from "./RegMark.tsx";
import { introInitial, introVariants } from "./board-intro.ts";
import { reducedMotion } from "../motion.ts";

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
  // a blocked move recoils the whole box. Driven imperatively so the board
  // keeps a stable identity (no remount), which is what lets the develop-in
  // play exactly once on level mount rather than restarting on every bump.
  const recoil = useAnimationControls();
  useEffect(() => {
    if (!bump || reducedMotion) return;
    const d = bump.payload;
    const vertical = d[0] !== 0;
    const kf = [0, (vertical ? d[0] : d[1]) * 5, 0];
    recoil.start({
      ...(vertical ? { y: kf } : { x: kf }),
      transition: { duration: 0.22, ease: "easeOut" as const },
    });
  }, [bump, recoil]);

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

  // The sheet is seated into the lit table, not floating above it: a full
  // hairline warm rim frames the panel evenly, a touch brighter on the top lip
  // where the lamp catches, and a short, low-opacity contact grounds it. A
  // heavy black drop would only dirty the warm glow the caisson is darker
  // than, so the outer shadow stays tight and diffuse.
  const drop =
    "inset 0 0 0 1px rgba(242,237,228,0.03), " +
    "inset 0 1px 0 rgba(242,237,228,0.05), " +
    "0 1px 2px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.22)";

  return (
    <motion.div
      animate={recoil}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative aspect-square w-[min(92vw,520px)] overflow-hidden rounded-md"
      style={{
        background:
          "radial-gradient(ellipse 80% 80% at 50% 50%, var(--color-box-glow), var(--color-box) 80%)",
        boxShadow: st.merged
          ? `inset 0 0 90px rgba(242,237,228,0.06), ${drop}`
          : `inset 0 0 70px rgba(69,224,236,0.04), inset 0 0 70px rgba(255,79,163,0.04), ${drop}`,
        transition: "box-shadow 500ms",
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
        <motion.g
          initial={introInitial}
          animate="visible"
          variants={introVariants.light}
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
        </motion.g>
        <motion.g
          initial={introInitial}
          animate="visible"
          variants={introVariants.marks}
        >
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
        </motion.g>
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
    </motion.div>
  );
}
