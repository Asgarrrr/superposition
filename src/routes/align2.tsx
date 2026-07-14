// Prototype v2 — "align to enter", powered by Motion. Two acetate films sit
// on a light table: the magenta one is spring-dragged into a register slot
// over the cyan one; as it nears, the slot brightens, it snaps home, prints
// white, and the lamp surges the screen open.
// Throwaway test route at /align2 — not wired into the app's screen flow.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from "motion/react";
import { LightField } from "../ui/components/LightField.tsx";
import { RegCross } from "../ui/components/RegCross.tsx";

const reduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// register point in viewport %, where the light opens from
const EYE = { cx: 50, cy: 52 };

export const Route = createFileRoute("/align2")({ component: AlignMotion });

const START = { x: 78, y: 50 };
const SNAP = 20; // px: auto-lock while dragging
const MAGNET = 66; // px: pull-in on release
const SPRING = { type: "spring", stiffness: 420, damping: 30 } as const;

function AlignMotion() {
  const navigate = useNavigate();
  const [solved, setSolved] = useState(false);
  const [opening, setOpening] = useState(false);

  // once registered, savour the lock (bloom + stamp) then flood the light
  useEffect(() => {
    if (!solved) return;
    const t = setTimeout(() => setOpening(true), 620);
    return () => clearTimeout(t);
  }, [solved]);

  // scale the whole interaction down on narrow viewports so the film's
  // offset, the lock thresholds and the glows stay proportional to the mark
  const [vw, setVw] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const scale = Math.max(0.5, Math.min(1, vw / 1440));
  const snap = SNAP * scale;
  const magnet = MAGNET * scale;

  // magenta film offset from register
  const x = useMotionValue(START.x);
  const y = useMotionValue(START.y);
  const dist = useTransform(() => Math.hypot(x.get(), y.get()));
  // seed / reset the offset proportionally (skipped once dragging or solved)
  useEffect(() => {
    if (solved) return;
    x.set(START.x * scale);
    y.set(START.y * scale);
  }, [scale, solved, x, y]);

  // proximity drives the whole scene (domains scale with the mark)
  const halo = useTransform(dist, [0, 150 * scale], [0.9, 0], { clamp: true });
  const ring = useTransform(dist, [0, 160 * scale], [0.85, 0.32], {
    clamp: true,
  });
  const cuff = useTransform(dist, [0, 150 * scale], [14, 4], { clamp: true });
  const cuffShadow = useTransform(
    cuff,
    (c) => `0 0 0 ${c}px rgba(232,184,75,0.12)`,
  );

  // pointer parallax on the cyan film (idle depth)
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const cx = useTransform(px, [-1, 1], [7, -7]);
  const cy = useTransform(py, [-1, 1], [5, -5]);

  // the opening: light irises out from the register point as a clip-path
  const iris = useMotionValue(0);
  const clip = useMotionTemplate`circle(${iris}% at ${EYE.cx}% ${EYE.cy}%)`;
  useEffect(() => {
    if (!opening) return;
    const controls = animate(iris, 150, {
      duration: 1,
      ease: [0.7, 0, 0.28, 1],
      onComplete: () => navigate({ to: "/" }),
    });
    return () => controls.stop();
  }, [opening, iris, navigate]);

  const lock = () => {
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    setSolved(true);
  };
  const onDrag = () => {
    if (!solved && dist.get() < snap) lock();
  };
  const onDragEnd = () => {
    if (!solved && dist.get() < magnet) lock();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (solved) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const film = (color: string): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    color,
    mixBlendMode: "screen",
    whiteSpace: "nowrap",
  });

  return (
    <div
      onPointerMove={onPointerMove}
      className="relative flex min-h-screen touch-none flex-col items-center justify-center overflow-hidden font-mono text-paper select-none"
      style={{
        background:
          "radial-gradient(ellipse 72% 62% at 40% 46%, var(--color-box-glow), #1a1611 45%, var(--color-room) 78%)",
      }}
    >
      <LightField variant={2} reduced={reduced} />
      <div className="grain absolute inset-0 opacity-[0.03]" />

      <RegCross pos="top-11 left-11" />
      <RegCross pos="top-11 right-11" />
      <RegCross pos="bottom-11 left-11" />
      <RegCross pos="bottom-11 right-11" />

      {/* register glow — brightens as the films close in */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          opacity: halo,
          background:
            "radial-gradient(circle, rgba(242,237,228,0.14), transparent 62%)",
        }}
      />

      {/* table ignition — the lamp surges the instant the films register:
          a warm flood, volumetric rays, and CMY→white shock rings */}
      <AnimatePresence>
        {solved && (
          <>
            <motion.div
              key="surge"
              className="pointer-events-none absolute inset-0"
              style={{
                mixBlendMode: "screen",
                background: `radial-gradient(circle at ${EYE.cx}% ${EYE.cy}%, rgba(242,237,228,0.9), rgba(232,184,75,0.16) 32%, transparent 62%)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.95, 0.42] }}
              transition={{
                duration: 1.1,
                ease: "easeOut",
                times: [0, 0.24, 1],
              }}
            />
            <motion.div
              key="rays"
              className="pointer-events-none absolute inset-0"
              style={{
                mixBlendMode: "screen",
                background: `repeating-conic-gradient(from 0deg at ${EYE.cx}% ${EYE.cy}%, transparent 0deg, rgba(242,237,228,0.16) 1.1deg, transparent 3deg, transparent 9deg)`,
                maskImage: `radial-gradient(circle at ${EYE.cx}% ${EYE.cy}%, transparent 4%, black 22%, transparent 58%)`,
                WebkitMaskImage: `radial-gradient(circle at ${EYE.cx}% ${EYE.cy}%, transparent 4%, black 22%, transparent 58%)`,
              }}
              initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
              animate={{
                opacity: [0, 0.55, 0],
                scale: [0.6, 0.95, 1.18],
                rotate: [-6, 0, 6],
              }}
              transition={{
                duration: 1.3,
                ease: "easeOut",
                times: [0, 0.3, 1],
              }}
            />
            {[
              { c: "var(--color-ink-cyan)", d: 0 },
              { c: "var(--color-ink-magenta)", d: 0.08 },
              { c: "var(--color-paper)", d: 0.16 },
            ].map((r, i) => (
              <motion.div
                key={`shock-${i}`}
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: `${EYE.cx}%`,
                  top: `${EYE.cy}%`,
                  width: 200,
                  height: 200,
                  marginLeft: -100,
                  marginTop: -100,
                  border: `2px solid ${r.c}`,
                  mixBlendMode: "screen",
                }}
                initial={{ scale: 0.1, opacity: 0.6 }}
                animate={{ scale: 4.4, opacity: 0 }}
                transition={{
                  duration: 1,
                  ease: [0.3, 0, 0.2, 1],
                  delay: r.d,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* lamp pool — a warm light cradling the wordmark on the table */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
        style={{
          width: "min(1180px, 94vw)",
          height: "min(680px, 60vh)",
          background:
            "radial-gradient(ellipse at center, rgba(43,36,25,0.85), rgba(36,31,25,0.35) 42%, transparent 72%)",
          filter: "blur(6px)",
        }}
      />

      {/* the two films */}
      <div
        className="relative z-10"
        style={{ fontSize: "clamp(34px, 8.5vw, 150px)" }}
      >
        {/* register slot — the housing the magenta film must be dropped into */}
        <motion.div
          className="absolute rounded-md border border-dashed"
          style={{
            inset: "-10px -16px",
            borderColor: "var(--color-tape)",
            opacity: solved ? 0 : ring,
          }}
          animate={{ opacity: solved ? 0 : undefined }}
        />
        {!solved && (
          <div
            className="pointer-events-none absolute text-[11px] font-medium tracking-[0.34em] text-tape/85"
            style={{ left: -16, top: -42 }}
          >
            CALER ICI
          </div>
        )}
        <div
          className="relative font-display italic"
          style={{ lineHeight: 1, letterSpacing: "0.02em" }}
        >
          <motion.span
            style={{ ...film("var(--color-ink-cyan)"), x: cx, y: cy }}
          >
            Superposition
          </motion.span>

          {/* magenta film's sheet edge — reads as physical acetate, rides
              with the film so you see the sheet slide into the slot */}
          <motion.div
            className="pointer-events-none absolute rounded-md border"
            style={{
              inset: "-10px -16px",
              borderColor: "rgba(255,79,163,0.32)",
              x,
              y,
            }}
            initial={false}
            animate={{ opacity: solved ? 0 : 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />

          {/* draggable magenta film */}
          <motion.span
            drag={!solved}
            dragMomentum={false}
            dragElastic={0.16}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
            whileDrag={{ cursor: "grabbing" }}
            style={{
              ...film("var(--color-ink-magenta)"),
              x,
              y,
              cursor: solved ? "default" : "grab",
            }}
          >
            Superposition
          </motion.span>

          <span className="invisible">Superposition</span>

          {/* drag handle rides the magenta film */}
          {!solved && (
            <motion.div
              className="pointer-events-none absolute grid place-items-center rounded-full border"
              style={{
                right: -10,
                bottom: 6,
                width: 44,
                height: 44,
                x,
                y,
                background: "rgba(20,17,14,0.55)",
                borderColor: "rgba(242,237,228,0.5)",
                boxShadow: cuffShadow,
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: "1px solid rgba(232,184,75,0.5)" }}
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
              <svg
                width="20"
                height="20"
                viewBox="0 0 22 22"
                fill="none"
                stroke="var(--color-paper)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 3v16M3 11h16M11 3l-2.5 2.5M11 3l2.5 2.5M11 19l-2.5-2.5M11 19l2.5-2.5M3 11l2.5-2.5M3 11l2.5 2.5M19 11l-2.5-2.5M19 11l-2.5 2.5" />
              </svg>
            </motion.div>
          )}

          {/* register bloom on lock */}
          <AnimatePresence>
            {solved && (
              <motion.div
                key="bloom"
                className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border"
                style={{
                  width: 40,
                  height: 40,
                  marginLeft: -20,
                  marginTop: -20,
                  borderColor: "var(--color-paper)",
                }}
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 2.8, opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* instruction — a stable label; it never blinks out on its own,
          the opening light simply floods over it. `relative z-10` lifts it
          above the LightField canvas (which, being positioned, would
          otherwise paint over this static text). */}
      <div className="relative z-10 mt-16 flex h-9 items-center px-6 text-center text-[12px] font-medium tracking-[0.16em] text-paper/85 sm:mt-24 sm:text-[14px]">
        Glissez le film magenta sur le cyan
      </div>

      {/* identity marginalia — genre, so the screen reads as a title rather
          than a loader. Hidden on small screens; flooded over on opening. */}
      <div className="pointer-events-none absolute bottom-8 left-6 hidden text-[11px] tracking-[0.26em] text-paper/45 uppercase sm:bottom-12 sm:left-[96px] sm:block sm:text-[12px]">
        Casse-tête de superposition
      </div>

      {/* contact flare — the two inks release a burst the instant they meet */}
      <AnimatePresence>
        {solved &&
          [
            { c: "var(--color-ink-cyan)", d: 0 },
            { c: "var(--color-ink-magenta)", d: 0.05 },
          ].map((f, i) => (
            <motion.div
              key={`flare-${i}`}
              className="pointer-events-none fixed rounded-full"
              style={{
                left: `${EYE.cx}%`,
                top: `${EYE.cy}%`,
                width: 240,
                height: 240,
                marginLeft: -120,
                marginTop: -120,
                zIndex: 40,
                background: `radial-gradient(circle, ${f.c} 0%, transparent 62%)`,
                mixBlendMode: "screen",
              }}
              initial={{ scale: 0.2, opacity: 0.7 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: f.d }}
            />
          ))}
      </AnimatePresence>

      {/* opening — a wavefront races out, the light irises the screen white */}
      <AnimatePresence>
        {opening && (
          <>
            <motion.div
              key="wavefront"
              className="pointer-events-none fixed rounded-full border-2"
              style={{
                left: `${EYE.cx}%`,
                top: `${EYE.cy}%`,
                width: 120,
                height: 120,
                marginLeft: -60,
                marginTop: -60,
                zIndex: 45,
                borderColor: "var(--color-paper)",
              }}
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 24, opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.5, 0, 0.2, 1] }}
            />
            <motion.div
              key="flood"
              className="pointer-events-none fixed inset-0 z-50"
              style={{
                clipPath: clip,
                background:
                  "radial-gradient(circle at " +
                  EYE.cx +
                  "% " +
                  EYE.cy +
                  "%, #ffffff 0%, #f7f3ea 60%, #f2ede4 100%)",
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
