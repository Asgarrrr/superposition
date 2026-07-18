// "Ready to print": dark veil, aligned wordmark, amber stamp.

import type { TraceStep } from "../../engine/types.ts";
import { LEVELS } from "../../engine/levels.ts";
import { Wordmark } from "./Wordmark.tsx";
import { ReplayGifButton } from "./ReplayGifButton.tsx";
import { m } from "../../paraglide/messages.js";
import { campaignReplayUrl } from "../replayLink.ts";

export function WinOverlay({
  plate,
  moves,
  best,
  hinted = false,
  trace,
  onNext,
}: {
  plate: number; // level number, 1-based
  moves: number;
  best: number | undefined;
  hinted?: boolean; // a hint was used: the solve is off the record
  trace?: TraceStep[]; // the raw solve trace, for the shareable replay GIF
  onNext: (() => void) | null;
}) {
  // The replay URL carries the level's stable id, not its 1-based number, so a
  // reordered bank can't break shared links (see replayLink / render.ts).
  // null when the line is too long for the replay endpoint (see replayLink) —
  // the action is then absent, like a hinted run's.
  const level = LEVELS[plate - 1];
  const gifUrl = trace && level ? campaignReplayUrl(level.id, trace) : null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-room/80 backdrop-blur-xs">
      <div className="scale-72">
        <Wordmark aligned size={36} />
      </div>
      <div
        className="sp-stamped rounded-sm border-[2.5px] border-tape px-4.5 py-2 font-mono text-[13px] tracking-[0.28em] text-tape uppercase"
        style={{ animationDelay: "550ms" }}
      >
        {m.win_stamp()}
      </div>
      <div className="font-mono text-[11px] tracking-[0.15em] text-paper/50">
        {m.win_summary({ plate: String(plate).padStart(2, "0"), count: moves })}
        {best !== undefined && best < moves ? m.win_record({ best }) : ""}
      </div>
      {hinted && (
        <div className="font-mono text-[10px] tracking-[0.18em] text-tape/70 uppercase">
          {m.win_hinted()}
        </div>
      )}
      {onNext ? (
        <button
          type="button"
          className="btn border-paper/40 text-paper"
          onClick={onNext}
        >
          {m.win_next()}
        </button>
      ) : (
        <div className="font-display text-xs italic text-paper/50">
          {m.win_complete()}
        </div>
      )}
      {gifUrl && <ReplayGifButton url={gifUrl} />}
    </div>
  );
}
