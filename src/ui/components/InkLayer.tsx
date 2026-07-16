// An ink film: grid, hatched walls, goal circle, pawn — all
// in a single color, laid down in `screen` blend over the light box.
// `misreg`: slight misalignment at rest; `shift`: world offset
// (offset mechanic); `iceTrail`: trail of the slide on ice.

import { motion } from "motion/react";
import type { Pos } from "../../engine/types.ts";
import { eq } from "../../engine/grid.ts";
import { boardSpan, CELL, cellCenter, PAD } from "./board-metrics.ts";
import { introInitial, introVariants } from "./board-intro.ts";

export function InkLayer({
  color,
  pawn,
  goal,
  walls,
  misreg,
  aligned,
  size,
  shift,
  iceTrail,
}: {
  color: string;
  pawn: Pos;
  goal: Pos;
  walls: Pos[];
  misreg: number;
  aligned: boolean;
  size: number;
  shift: Pos;
  iceTrail: { from: Pos } | null;
}) {
  const span = boardSpan(size);
  const [cx, cy] = cellCenter(pawn);
  const [gx, gy] = cellCenter(goal);
  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      className="absolute inset-0 h-full w-full mix-blend-screen"
      style={{
        transform: aligned
          ? "translate(0,0)"
          : `translate(${misreg}px, ${-misreg}px)`,
        transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <g
        style={{
          transform: `translate(${shift[1] * CELL}px, ${shift[0] * CELL}px)`,
          transition: "transform 380ms cubic-bezier(0.3,1.4,0.4,1)",
        }}
      >
        <motion.g
          initial={introInitial}
          animate="visible"
          variants={introVariants.grid}
        >
          {Array.from({ length: size + 1 }, (_, i) => (
            <g key={i} stroke={color} strokeOpacity="0.22" strokeWidth="1">
              <line
                x1={PAD}
                y1={PAD + i * CELL}
                x2={PAD + size * CELL}
                y2={PAD + i * CELL}
              />
              <line
                x1={PAD + i * CELL}
                y1={PAD}
                x2={PAD + i * CELL}
                y2={PAD + size * CELL}
              />
            </g>
          ))}
        </motion.g>
        <motion.g
          initial={introInitial}
          animate="visible"
          variants={introVariants.walls}
        >
          {walls.map(([r, c]) => (
            <g
              key={`${r}-${c}`}
              opacity={aligned ? 0.3 : 1}
              style={{ transition: "opacity 400ms" }}
            >
              <rect
                x={PAD + c * CELL + 4}
                y={PAD + r * CELL + 4}
                width={CELL - 8}
                height={CELL - 8}
                fill={color}
                fillOpacity="0.14"
              />
              {[0, 1, 2, 3].map((k) => (
                <line
                  key={k}
                  x1={PAD + c * CELL + 6 + k * 12}
                  y1={PAD + r * CELL + CELL - 6}
                  x2={PAD + c * CELL + CELL - 6}
                  y2={PAD + r * CELL + 6 + k * 12}
                  stroke={color}
                  strokeWidth="2"
                  strokeOpacity="0.7"
                />
              ))}
            </g>
          ))}
        </motion.g>
        <motion.circle
          initial={introInitial}
          animate="visible"
          variants={introVariants.goal}
          cx={gx}
          cy={gy}
          r={CELL * 0.3}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={eq(pawn, goal) ? undefined : "5 5"}
        />
        {iceTrail && (
          <line
            x1={cellCenter(iceTrail.from)[0]}
            y1={cellCenter(iceTrail.from)[1]}
            x2={cx}
            y2={cy}
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.25"
            className="sp-trail"
          />
        )}
        <motion.circle
          initial={introInitial}
          animate="visible"
          variants={introVariants.pawn}
          cx={cx}
          cy={cy}
          r={aligned ? CELL * 0.24 : CELL * 0.2}
          fill={color}
          style={{
            transition:
              "cx 170ms cubic-bezier(0.3,1.25,0.5,1), cy 170ms cubic-bezier(0.3,1.25,0.5,1), r 300ms",
          }}
        />
      </g>
    </svg>
  );
}
