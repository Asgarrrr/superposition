// The app's title screen — "align to enter". Two acetate films sit on the
// light table: the magenta one is spring-dragged into a register slot over the
// cyan one; as it nears, the slot brightens, it snaps home, prints white, and
// the lamp surges the screen open — at which point `onStart` hands off to the
// level select.

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { m } from "../../paraglide/messages.js";
import { Room } from "../components/Room.tsx";
import { EYE, floodGradient } from "../transition.ts";
import { reducedMotion as reduced } from "../motion.ts";

// the title's own wash — biased left of the register point to seat the wordmark
// and its slot, where the board and edition sit centred. Same room, its lamp
// just pulled to one side of the composition.
const TITLE_GRADIENT =
  "radial-gradient(ellipse 72% 62% at 40% 46%, var(--color-box-glow), #1a1611 45%, var(--color-room) 78%)";

const START = { x: 78, y: 50 };
const SNAP = 20; // px: auto-lock while dragging
const MAGNET = 66; // px: pull-in on release
const SPRING = { type: "spring", stiffness: 420, damping: 30 } as const;

export function EnterScreen({ onStart }: { onStart: () => void }) {
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

  // magenta film offset from register — initialised already off-register (to
  // the right) so the very first painted frame is the start of the fly-in, not
  // the rest pose; the entrance effect then springs it home. Reduced-motion
  // starts at rest.
  const x = useMotionValue(START.x * scale + (reduced ? 0 : 220));
  const y = useMotionValue(START.y * scale + (reduced ? 0 : 26));
  const dist = useTransform(() => Math.hypot(x.get(), y.get()));

  // proximity drives the whole scene (domains scale with the mark)
  const halo = useTransform(dist, [0, 150 * scale], [0.9, 0], { clamp: true });
  const ring = useTransform(dist, [0, 160 * scale], [0.85, 0.32], {
    clamp: true,
  });
  // corner crosses breathe with the film's live offset (0→1), so the whole
  // sheet comes into register at once when the magenta locks home
  const crossSpread = useTransform(dist, [0, 150 * scale], [0, 1], {
    clamp: true,
  });

  // entrance — one shot: the block fades up and settles in scale while the
  // loose magenta film flies in from off-register and lands with a bounce.
  // The ref guard survives StrictMode's remount, and we deliberately DON'T
  // stop the animations on cleanup so mount-1's one-shot finishes cleanly.
  const appear = useMotionValue(reduced ? 1 : 0);
  const mScale = useMotionValue(reduced ? 1 : 1.06);
  const entered = useRef(false);
  useEffect(() => {
    if (reduced || entered.current) return;
    entered.current = true;
    animate(appear, 1, { duration: 0.55, ease: "easeOut" });
    animate(mScale, 1, {
      type: "spring",
      stiffness: 120,
      damping: 16,
      delay: 0.05,
    });
    const spring = {
      type: "spring",
      stiffness: 90,
      damping: 13,
      delay: 0.22,
    } as const;
    animate(x, START.x * scale, spring);
    animate(y, START.y * scale, spring);
    // deps intentionally empty — runs once, scale read live
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drag weight — the film banks against the fling velocity, then rights
  // itself. Raw velocity is jittery, so we spring-smooth it first (per Motion
  // docs) before mapping to a bank angle; centred 3-point range so a still
  // film sits level.
  const xVelocity = useVelocity(x);
  const smoothVelocity = useSpring(xVelocity, { stiffness: 200, damping: 40 });
  const tilt = useTransform(smoothVelocity, [-2000, 0, 2000], [7, 0, -7], {
    clamp: true,
  });

  // pointer parallax on the cyan film (idle depth)
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const cx = useTransform(px, [-1, 1], [7, -7]);
  const cy = useTransform(py, [-1, 1], [5, -5]);

  // the opening: light irises out from the register point as a clip-path,
  // then hands off to the level select
  const iris = useMotionValue(0);
  const clip = useMotionTemplate`circle(${iris}% at ${EYE.cx}% ${EYE.cy}%)`;
  useEffect(() => {
    if (!opening) return;
    const controls = animate(iris, 150, {
      // reduced motion: skip the iris sweep, flood instantly and hand off
      duration: reduced ? 0.01 : 1,
      ease: [0.7, 0, 0.28, 1],
      onComplete: onStart,
    });
    return () => controls.stop();
  }, [opening, iris, onStart]);

  const lock = () => {
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    if (!reduced) {
      animate(mScale, [1, 1.06, 1], { duration: 0.42, ease: "easeOut" });
    }
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
      className="relative flex min-h-dvh touch-none flex-col items-center justify-center overflow-hidden font-mono text-paper select-none"
    >
      {/* the shared lit table — the room the edition and board also open in.
          Its corner marks breathe into register with the wordmark (crossSpread)
          as the films close in (variant 2: the cool counter-lamp on the right). */}
      <Room
        variant={2}
        reduced={reduced}
        gradient={TITLE_GRADIENT}
        crossSpread={crossSpread}
        wideCorners
        grainOpacity={0.03}
      />

      {/* register glow — a warm bloom the films kindle as they close in.
          Centred on the register point (EYE), elliptical so it cradles the
          wordmark's width, screen-blended and softly blurred so it reads as
          emitted light rather than a disc pasted on the table. */}
      <motion.div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
        style={{
          left: `${EYE.cx}%`,
          top: `${EYE.cy}%`,
          width: "min(960px, 84vw)",
          height: "min(340px, 38vh)",
          opacity: halo,
          mixBlendMode: "screen",
          background:
            "radial-gradient(ellipse at center, rgba(242,237,228,0.16), rgba(232,184,75,0.05) 46%, transparent 72%)",
          filter: "blur(14px)",
        }}
      />

      {/* table ignition — the lamp surges the instant the films register:
          a warm flood, volumetric rays, and CMY→white shock rings.
          Suppressed under reduced-motion (full-screen flashing/scaling). */}
      <AnimatePresence>
        {solved && !reduced && (
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

      {/* the two films — anchored on the register point (EYE) so the spot
          where the inks superimpose is exactly where the light irises open;
          absolute so the instruction below can't shift it off-centre */}
      <motion.div
        className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
        style={{
          top: `${EYE.cy}%`,
          fontSize: "clamp(34px, 8.5vw, 150px)",
          opacity: appear,
        }}
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
        {/* pencil-note annotation — a scrawled "align here" and a hand-drawn
            arrow curling down into the slot, in the printer's tape colour */}
        {!solved && (
          <div
            className="pointer-events-none absolute flex items-end gap-1 text-tape/85"
            style={{ left: -20, top: -64 }}
          >
            <span
              className="font-display text-[21px] leading-none italic"
              style={{ transform: "rotate(-5deg)" }}
            >
              {m.enter_annotation()}
            </span>
            <svg
              width="40"
              height="46"
              viewBox="0 0 40 46"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-tape/70"
            >
              <path d="M4 4c9 1 17 8 19 20 1 5 1 10 0 15" />
              <path d="M14 32l9 8 8-9" />
            </svg>
          </div>
        )}
        <motion.div
          className="relative font-display italic"
          style={{ lineHeight: 1, letterSpacing: "0.02em", scale: mScale }}
        >
          <motion.span
            style={{
              ...film("var(--color-ink-cyan)"),
              x: cx,
              y: cy,
            }}
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
              rotate: tilt,
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
              rotate: tilt,
              cursor: solved ? "default" : "grab",
            }}
          >
            Superposition
          </motion.span>

          <span className="invisible">Superposition</span>

          {/* grab knob — flat, thin-stroke ring in keeping with the marks;
              no gloss, no glow */}
          {!solved && (
            <motion.div
              className="pointer-events-none absolute grid place-items-center rounded-full"
              style={{
                right: -12,
                bottom: 4,
                width: 36,
                height: 36,
                x,
                y,
                background: "rgba(16,13,10,0.32)",
                border: "1px solid rgba(242,237,228,0.32)",
              }}
            >
              {/* subtle idle pulse — CSS-driven so it can't glitch on reset */}
              <div
                className="sp-knob-pulse absolute rounded-full"
                style={{
                  inset: -1,
                  border: "1px solid rgba(242,237,228,0.22)",
                }}
              />
              <svg
                width="15"
                height="15"
                viewBox="0 0 22 22"
                fill="none"
                stroke="var(--color-paper)"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              >
                <path d="M11 4v14M4 11h14M11 4l-2 2.4M11 4l2 2.4M11 18l-2-2.4M11 18l2-2.4M4 11l2.4-2M4 11l2.4 2M18 11l-2.4-2M18 11l-2.4 2" />
              </svg>
            </motion.div>
          )}

          {/* instruction — hangs from the wordmark's baseline so it never
              pulls the title off the register point; the opening light simply
              floods over it. */}
          <div className="pointer-events-none absolute top-full left-1/2 mt-16 flex h-9 -translate-x-1/2 items-center px-6 text-center text-[12px] font-medium tracking-[0.16em] whitespace-nowrap text-paper/85 sm:mt-24 sm:text-[14px]">
            {m.enter_instruction()}
          </div>

          {/* register bloom on lock */}
          <AnimatePresence>
            {solved && !reduced && (
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
        </motion.div>
      </motion.div>

      {/* identity marginalia — genre, so the screen reads as a title rather
          than a loader. Hidden on small screens; flooded over on opening. */}
      <div className="pointer-events-none absolute bottom-8 left-6 hidden text-[11px] tracking-[0.26em] text-paper/45 uppercase sm:bottom-12 sm:left-[96px] sm:block sm:text-[12px]">
        {m.enter_genre()}
      </div>

      {/* contact flare — the two inks release a burst the instant they meet */}
      <AnimatePresence>
        {solved &&
          !reduced &&
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
            {!reduced && (
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
            )}
            <motion.div
              key="flood"
              className="pointer-events-none fixed inset-0 z-50"
              style={{
                clipPath: clip,
                background: floodGradient,
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
