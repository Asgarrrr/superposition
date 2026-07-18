// Builds the shareable replay-GIF URL from a solved game's trace. The server
// re-validates the encoded line through the engine (server/replay/render.ts),
// so this is pure address assembly — the corrections are collapsed to the
// winning line, which is all the replay shows.

import type { TraceStep } from "../engine/types.ts";
import {
  encodeTrace,
  MAX_REPLAY_STEPS,
  winningLine,
} from "../lib/replayTrace.ts";

// Above MAX_REPLAY_STEPS the endpoint refuses the line (decodeTrace returns
// null → 404), so the URL would be dead. Return null instead and let the UI
// drop the action — no dead link, no false "copied".
export function campaignReplayUrl(
  levelId: string,
  trace: TraceStep[],
): string | null {
  const line = winningLine(trace);
  if (line.length > MAX_REPLAY_STEPS) return null;
  return `${window.location.origin}/api/replay/c/${levelId}/${encodeTrace(line)}.gif`;
}

/** Daily replay GIF for a (date, tier). The endpoint only serves it once the
 *  day has passed (UTC) — the caller gates the action on the same rule. Null
 *  when the line is too long to replay (see campaignReplayUrl). */
export function dailyReplayUrl(
  date: string,
  tier: number,
  trace: TraceStep[],
): string | null {
  const line = winningLine(trace);
  if (line.length > MAX_REPLAY_STEPS) return null;
  return `${window.location.origin}/api/replay/d/${date}/${tier}/${encodeTrace(line)}.gif`;
}
