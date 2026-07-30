// The clean-pull seal: the two inks laid in perfect register — the game's own
// superposition, screen-blended so the overlap prints light. One pass, no
// correction.
//
// ONE mark for that idea, everywhere it is claimed: the leaderboard rows, the
// standing footer, and the edition's plates. The selector used to draw its own
// ′ instead, at 10px and /40 opacity — a mark the legend never taught and which
// read as a speck of dust rather than something earned.
//
// `label` names it for the surface it sits on: the boards call it a clean pull,
// the edition calls it by its stamp name.

import { m } from "../../paraglide/messages.js";

export function CleanSeal({ label }: { label?: string }) {
  const name = label ?? m.clean_solve();
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      className="shrink-0 translate-y-[1px]"
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <g style={{ mixBlendMode: "screen" }}>
        <circle cx="5.4" cy="7" r="3.4" fill="var(--color-ink-cyan)" />
        <circle cx="8.6" cy="7" r="3.4" fill="var(--color-ink-magenta)" />
      </g>
    </svg>
  );
}
