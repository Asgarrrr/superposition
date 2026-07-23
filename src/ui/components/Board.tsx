// The light box: two ink films, the white overlay (light squares,
// registration marks, merge bloom) and the recoil when a move
// is blocked. Receives the state, decides nothing.

import { useEffect, useMemo } from "react";
import { motion, useAnimationControls } from "motion/react";
import type { GameState, Level, Pos } from "../../engine/types.ts";
import { eq, sub } from "../../engine/grid.ts";
import { successors } from "../../engine/successors.ts";
import type { Pulse } from "../hooks/useGame.ts";
import { boardSpan, CELL, cellCenter } from "./board-metrics.ts";
import { InkLayer } from "./InkLayer.tsx";
import { RegMark } from "./RegMark.tsx";
import { RegPin } from "./RegPin.tsx";
import { introInitial, introVariants } from "./board-intro.ts";
import { reducedMotion } from "../motion.ts";

export function Board({
  level,
  st,
  solved,
  bump,
  bloom,
  armed = false,
  aim = null,
  demo = false,
  guideGhosts = null,
  guides = null,
  iceTrailA,
  iceTrailB,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  children,
}: {
  level: Level;
  st: GameState;
  solved: boolean;
  bump: Pulse | null;
  bloom: Pulse | null;
  armed?: boolean; // ✕ armed on a merged pawn: preview where the split sends each ink
  aim?: Pos | null; // while sliding: the direction being aimed — narrow the split preview to it
  demo?: boolean; // tutorial sandbox: frame the box in tape so it reads apart
  guideGhosts?: { a: Pos[]; b: Pos[] } | null; // tutorial: landing preview of the guided push
  guides?: { from: Pos; to: Pos; tone: "a" | "b" | "w" }[] | null; // tutorial: marching arrows drawing the gesture, in BOARD coordinates (this overlay is not shifted by `off` — magenta film positions must arrive pre-converted)
  iceTrailA: { from: Pos } | null;
  iceTrailB: { from: Pos } | null;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel?: (e: React.TouchEvent) => void;
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

  // Split preview: while ✕ is armed on the merged pawn, the split's landing
  // cells by ink (cyan toward the arrow, magenta opposite). Read straight off
  // the engine's successors so it can't drift from the rule. When the finger is
  // aiming a direction (maintien-slide), narrow to that one split — the two
  // colours of the move about to fire — instead of showing every option.
  const ghosts = useMemo(() => {
    if (!armed || !st.merged) return { a: [] as Pos[], b: [] as Pos[] };
    const a: Pos[] = [];
    const b: Pos[] = [];
    for (const [inp, next] of successors(st, level)) {
      if (inp.kind !== "split" || next.merged) continue;
      if (aim && !eq(inp.dir, aim)) continue;
      a.push(next.a);
      b.push(next.b);
    }
    return { a, b };
  }, [armed, aim, st, level]);
  // the guided push's landing cells ride the same ghost channel as the split
  // preview, so both hints share one visual vocabulary
  const ghostsA = guideGhosts ? [...ghosts.a, ...guideGhosts.a] : ghosts.a;
  const ghostsB = guideGhosts ? [...ghosts.b, ...guideGhosts.b] : ghosts.b;

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
  // the tutorial sandbox wears a tape frame so it can't be mistaken for a level
  const frame = demo
    ? "inset 0 0 0 2px rgba(232,184,75,0.55), 0 0 22px rgba(232,184,75,0.12), "
    : "";

  return (
    <motion.div
      animate={recoil}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="relative aspect-square w-[min(92vw,60svh,520px)] touch-none overflow-hidden rounded-md"
      style={{
        background:
          "radial-gradient(ellipse 80% 80% at 50% 50%, var(--color-box-glow), var(--color-box) 80%)",
        boxShadow: st.merged
          ? `${frame}inset 0 0 90px rgba(242,237,228,0.06), ${drop}`
          : `${frame}inset 0 0 70px rgba(69,224,236,0.04), inset 0 0 70px rgba(255,79,163,0.04), ${drop}`,
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
        splitGhosts={ghostsA}
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
        splitGhosts={ghostsB}
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
        {/* registration pins (repere): calage anchors fixed to the glass, so
            they render in board coordinates — never shifted by `off`, visible
            under both films. Doubled cyan/magenta while the worlds drift, seated
            to a single head when aligned or merged, echoing the corner marks. */}
        <motion.g
          initial={introInitial}
          animate="visible"
          variants={introVariants.marks}
        >
          {(level.pins ?? []).map(([r, c]) => {
            const [x, y] = cellCenter([r, c]);
            return (
              <RegPin
                key={`pin-${r}-${c}`}
                x={x}
                y={y}
                offPx={offPx}
                merged={st.merged}
                locked={solved}
              />
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
        {/* tutorial arrows: the gesture drawn where it will act, marching from
            each ink toward its landing — pulled back from both cell centres so
            pawn and ghost ring stay readable under the arrowhead */}
        {guides?.map(({ from, to, tone }, i) => {
          const [x1, y1] = cellCenter(from);
          const [x2, y2] = cellCenter(to);
          const len = Math.hypot(x2 - x1, y2 - y1);
          if (len === 0) return null;
          const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
          const sx = x1 + ux * (CELL * 0.34);
          const sy = y1 + uy * (CELL * 0.34);
          const ex = x2 - ux * (CELL * 0.36);
          const ey = y2 - uy * (CELL * 0.36);
          const color =
            tone === "a"
              ? "var(--color-ink-cyan)"
              : tone === "b"
                ? "var(--color-ink-magenta)"
                : "var(--color-paper)";
          const head = 9;
          const [hx, hy] = [ex - ux * head, ey - uy * head];
          const [px, py] = [-uy, ux];
          return (
            <g
              key={`${i}-${from[0]}-${from[1]}`}
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            >
              <line className="sp-march" x1={sx} y1={sy} x2={ex} y2={ey} />
              <line x1={ex} y1={ey} x2={hx + px * 5.5} y2={hy + py * 5.5} />
              <line x1={ex} y1={ey} x2={hx - px * 5.5} y2={hy - py * 5.5} />
            </g>
          );
        })}
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
