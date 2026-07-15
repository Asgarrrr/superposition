// Win celebration for the daily level: the "ready to print" veil, the aligned
// wordmark and stamp, and the result line. Posting the score and the day's
// leaderboard live in the always-visible rail (DailyBoard), so this overlay is
// pure celebration — the daily counterpart to WinOverlay.

import { m } from "../../paraglide/messages.js";
import { Wordmark } from "./Wordmark.tsx";

export function DailyOverlay({
  moves,
  optimal,
}: {
  moves: number;
  optimal: number;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-room/80 backdrop-blur-xs">
      <div className="scale-72">
        <Wordmark aligned size={36} />
      </div>
      <div
        className="rounded-sm border-[2.5px] border-tape px-4.5 py-2 font-mono text-[13px] tracking-[0.28em] text-tape uppercase"
        style={{
          animation: "sp-stamp 700ms cubic-bezier(0.2,1.4,0.4,1) 550ms both",
        }}
      >
        {m.win_stamp()}
      </div>
      <div className="font-mono text-[11px] tracking-[0.15em] text-paper/50">
        {m.daily_solved({ count: moves })}
        {optimal ? ` · ${m.daily_optimal({ optimal })}` : ""}
      </div>
    </div>
  );
}
