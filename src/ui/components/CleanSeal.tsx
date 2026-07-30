// The clean-pull seal: the two inks laid in perfect register — the game's own
// superposition, screen-blended so the overlap prints light. One pass, no
// correction.
//
// The BOARDS' mark for that idea: the ranked rows and the standing footer, so a
// player sees the same seal whether or not their row is in the visible cut. The
// edition says it differently — a plate's record frame changes ink instead of
// wearing a badge (see `sp-ink-frame`) — because there the mark has a frame to
// ride and a row of its own to stay quiet in.

import { m } from "../../paraglide/messages.js";

export function CleanSeal() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      className="shrink-0 translate-y-[1px]"
      role="img"
      aria-label={m.clean_solve()}
    >
      <title>{m.clean_solve()}</title>
      <g style={{ mixBlendMode: "screen" }}>
        <circle cx="5.4" cy="7" r="3.4" fill="var(--color-ink-cyan)" />
        <circle cx="8.6" cy="7" r="3.4" fill="var(--color-ink-magenta)" />
      </g>
    </svg>
  );
}
