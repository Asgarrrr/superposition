// The route reveal — the seam-honest continuation of the enter flood. On the
// light table the white IS the light, and the two films separate out of it: the
// first frame is the same white sheet the enter screen ends on (a `floodGradient`
// sheet at full opacity); it lifts to uncover a cyan/magenta dot screen (classic
// 15° / -15° angles) sitting on the dark table, which then resolves — dots
// shrinking as the two inks de-register — into the clean edition. White →
// printed rosette → table, no dead fade. The content underneath develops in
// (staggered) as the overlay clears.

import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useTransform,
  type MotionStyle,
} from "motion/react";
import { floodGradient } from "../transition.ts";

export function RevealOverlay() {
  const r = useMotionValue(5.2); // dot radius, shrinks to nothing
  const drift = useMotionValue(0); // the two ink screens pull out of register
  const dots = useMotionValue(1); // rosette group fades out as it resolves
  const sheet = useMotionValue(1); // the white light lifting off first

  // drive only the dot radius through a CSS var so the browser doesn't re-parse
  // the whole radial-gradient declaration every frame — the gradient strings are
  // static and reference var(--dot)
  const dotPx = useMotionTemplate`${r}px`;
  const cyanX = useTransform(drift, (v) => -v);

  useEffect(() => {
    const ease = [0.55, 0, 0.2, 1] as const;
    const controls = [
      animate(r, 0, { duration: 0.95, ease }),
      animate(drift, 24, { duration: 0.95, ease }),
      animate(dots, 0, { duration: 0.95, ease: "easeIn" }),
      animate(sheet, 0, { duration: 0.5, ease: "easeOut" }),
    ];
    return () => controls.forEach((c) => c.stop());
  }, [r, drift, dots, sheet]);

  const layer = {
    position: "absolute",
    inset: "-40%",
    backgroundSize: "12px 12px",
    mixBlendMode: "screen",
  } as const;
  const cyan =
    "radial-gradient(circle, rgba(69,224,236,0.85) var(--dot), transparent var(--dot))";
  const magenta =
    "radial-gradient(circle, rgba(255,79,163,0.85) var(--dot), transparent var(--dot))";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <motion.div
        className="absolute inset-0"
        style={{ opacity: dots, "--dot": dotPx } as MotionStyle}
      >
        <motion.div
          style={{ ...layer, backgroundImage: cyan, rotate: 15, x: cyanX }}
        />
        <motion.div
          style={{ ...layer, backgroundImage: magenta, rotate: -15, y: drift }}
        />
      </motion.div>
      <motion.div
        className="absolute inset-0"
        style={{ background: floodGradient, opacity: sheet }}
      />
    </div>
  );
}
