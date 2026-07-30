// The daily's discovery clock, as the player sees it tick.
//
// Purely cosmetic. The ranked value is derived server-side at submission from
// the same anchor (see server/discovery.ts) and is never read back from here —
// a client whose clock is wrong, or deliberately set wrong, only misleads
// itself. What this hook renders is the player's own view of the interval the
// server is measuring.

import { useCallback, useEffect, useState } from "react";

/** Where the clock reads from: the server's anchor for this player, and the
 *  server's own time when it replied. */
export interface ClockSource {
  servedAt: string | null;
  serverNow: string;
}

/** Milliseconds since the grid was served, or null when nothing was anchored
 *  (signed-out play — there is no clock to show, because none is running).
 *
 *  `frozen` halts it where it stands. The measurement ends at submission, so a
 *  counter still running after the win would drift away from the value the
 *  server actually recorded — and the player would read the wrong number. */
export function useDiscoveryClock(
  source: ClockSource | undefined,
  frozen = false,
): number | null {
  const { servedAt, serverNow } = source ?? { servedAt: null, serverNow: "" };
  // The offset between the two clocks, fixed once per opening: the client's own
  // notion of "now" may be minutes off, so we measure from where the SERVER was
  // rather than trusting Date.now() to agree with it.
  const [skew] = useState(() =>
    serverNow ? Date.parse(serverNow) - Date.now() : 0,
  );
  const anchor = servedAt ? Date.parse(servedAt) : null;
  const [elapsed, setElapsed] = useState(() =>
    anchor === null ? null : Math.max(0, Date.now() + skew - anchor),
  );

  useEffect(() => {
    if (anchor === null || frozen) return;
    // once per second is the display's resolution; the ranked value keeps its
    // full precision server-side
    const tick = () => setElapsed(Math.max(0, Date.now() + skew - anchor));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [anchor, skew, frozen]);

  return anchor === null ? null : elapsed;
}

/**
 * What the board's standing says about this player's recorded time. Three
 * states on purpose, because "no answer yet" and "ranked, but never measured"
 * are different answers and collapsing them was a bug: on an uncertified day
 * the second case fell through to the live counter, so the rail ran a clock for
 * minutes while the stored value was null and the board rightly showed no time.
 *
 *   · undefined — the board has not answered yet;
 *   · null — ranked and unmeasured: there is no time to show;
 *   · a number — ranked and measured.
 */
export type Recorded = number | null | undefined;

export const recordedFrom = (
  mine: { elapsedMs?: number | null } | null,
): Recorded => (mine ? (mine.elapsedMs ?? null) : undefined);

/** The live counter stops as soon as the run is won or the board has answered:
 *  the measurement ends at submission, so a counter still running past either
 *  would drift away from the value the server recorded. */
export const clockFrozen = (solved: boolean, recorded: Recorded): boolean =>
  solved || recorded !== undefined;

/** What to put on screen: the recorded value once the board has one — not a
 *  counter that would keep climbing past it on a reload — and the live counter
 *  only while no answer has arrived. */
export const displayedClock = (
  recorded: Recorded,
  live: number | null,
): number | null => (recorded === undefined ? live : recorded);

/** The daily's clock as the play screen needs it: one reading, plus the hook
 *  the leaderboard rail calls back with the caller's standing. Composes the
 *  three rules above so the screen holds none of them. */
export function useDailyClock(
  source: ClockSource | undefined,
  solved: boolean,
): {
  clock: number | null;
  onStanding: (mine: { elapsedMs?: number | null } | null) => void;
} {
  const [recorded, setRecorded] = useState<Recorded>(undefined);
  const live = useDiscoveryClock(source, clockFrozen(solved, recorded));
  return {
    clock: displayedClock(recorded, live),
    onStanding: useCallback(
      (mine: { elapsedMs?: number | null } | null) =>
        setRecorded(recordedFrom(mine)),
      [],
    ),
  };
}

/** `m:ss`, growing to `h:mm:ss` past the hour — the reading the board and the
 *  play screen share. There is no cap on the ranked value, and the weekend 6×6
 *  can honestly take hours, so the hour field has to exist. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const ss = String(seconds).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
    : `${minutes}:${ss}`;
}
