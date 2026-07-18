// Builds the shareable replay-GIF URL from a solved game's trace. The server
// re-validates the encoded line through the engine (server/replay/render.ts),
// so this is pure address assembly — the corrections are collapsed to the
// winning line, which is all the replay shows.

import type { TraceStep } from "../engine/types.ts";
import { encodeTrace, winningLine } from "../lib/replayTrace.ts";

/** Campaign replay GIF for a 1-based plate. */
export function campaignReplayUrl(plate: number, trace: TraceStep[]): string {
  const line = encodeTrace(winningLine(trace));
  return `${window.location.origin}/api/replay/c/${plate}/${line}.gif`;
}

/** Daily replay GIF for a (date, tier). The endpoint only serves it once the
 *  day has passed (UTC) — the caller gates the action on the same rule. */
export function dailyReplayUrl(
  date: string,
  tier: number,
  trace: TraceStep[],
): string {
  const line = encodeTrace(winningLine(trace));
  return `${window.location.origin}/api/replay/d/${date}/${tier}/${line}.gif`;
}
