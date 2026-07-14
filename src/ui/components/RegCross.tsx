// A registration cross — the sheet's two films, doubled cyan/magenta and
// slightly off, in `screen` blend. Frames the light table at each corner.
// When a `spread` (0→1) is supplied, the magenta film's mis-registration
// breathes with it, so the corners come into register with the wordmark.

import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";

const shape = (color: string) => (
  <>
    <line x1="-7.5" y1="0" x2="7.5" y2="0" stroke={color} strokeWidth="1.2" />
    <line x1="0" y1="-7.5" x2="0" y2="7.5" stroke={color} strokeWidth="1.2" />
    <circle r="4.2" fill="none" stroke={color} strokeWidth="1.2" />
  </>
);

export function RegCross({
  pos,
  spread,
}: {
  pos: string;
  spread?: MotionValue<number>;
}) {
  // no spread (title screen) → the offset stays at full amplitude, matching
  // the original fixed (3, 2) mis-registration.
  const fallback = useMotionValue(1);
  const s = spread ?? fallback;
  const mx = useTransform(s, (v) => 11 + 3 * v);
  const my = useTransform(s, (v) => 12 + 2 * v);
  return (
    <svg
      width="26"
      height="27"
      viewBox="0 0 26 27"
      className={`absolute ${pos}`}
      style={{ opacity: 0.6 }}
    >
      <g style={{ mixBlendMode: "screen" }}>
        <g transform="translate(11,12)">{shape("var(--color-ink-cyan)")}</g>
        <motion.g style={{ x: mx, y: my }}>
          {shape("var(--color-ink-magenta)")}
        </motion.g>
      </g>
    </svg>
  );
}
