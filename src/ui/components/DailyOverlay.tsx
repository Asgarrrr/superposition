// Win celebration for the daily level: the "ready to print" veil, the aligned
// wordmark and stamp, and the result line. Posting the score and the day's
// leaderboard live in the always-visible rail (DailyBoard), so this overlay is
// pure celebration — the daily counterpart to WinOverlay.

import { useState } from "react";
import type { Level, TraceStep } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { utcDay } from "../../lib/day.ts";
import { buildDailyShare, shareOrCopy } from "../dailyShare.ts";
import { dailyReplayUrl } from "../replayLink.ts";
import { Wordmark } from "./Wordmark.tsx";

export function DailyOverlay({
  level,
  date,
  tier,
  moves,
  optimal,
  streak = 0,
  trace,
}: {
  level: Level;
  date: string;
  tier: number;
  moves: number;
  optimal: number;
  streak?: number; // current daily streak; a discreet reminder when > 0
  trace?: TraceStep[]; // raw solve trace, for the shareable replay GIF
}) {
  // the copy confirmation is a records moment — one of the rare licences for
  // the tape accent; it self-clears so the button rests in paper again.
  const [copied, setCopied] = useState(false);
  const [gifCopied, setGifCopied] = useState(false);
  const onShare = async () => {
    const url = `${window.location.origin}/daily/${tier}`;
    const text = buildDailyShare({ level, date, tier, moves, optimal, url });
    if ((await shareOrCopy(text)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // the replay GIF exists only once the puzzle's day has fully passed (UTC) —
  // rendering a still-live daily would spoil it, so the server 403s it.
  const gifReady = date < utcDay();
  // null when the line is too long for the replay endpoint (see replayLink).
  const gifUrl = trace ? dailyReplayUrl(date, tier, trace) : null;
  const onShareGif = async () => {
    if (!gifUrl) return;
    if ((await shareOrCopy(gifUrl)) === "copied") {
      setGifCopied(true);
      setTimeout(() => setGifCopied(false), 2000);
    }
  };

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
        {m.daily_solved({ count: moves })}
        {optimal ? ` · ${m.daily_optimal({ optimal })}` : ""}
      </div>
      {streak > 0 && (
        <div className="font-mono text-[10px] tracking-[0.2em] text-paper/40 uppercase">
          {m.daily_streak({ count: streak })}
        </div>
      )}
      <button
        type="button"
        onClick={onShare}
        className={`btn transition-colors ${
          copied ? "border-tape/60 text-tape" : "hover:text-paper/80"
        }`}
      >
        {copied ? m.daily_share_copied() : m.daily_share_button()}
      </button>
      {/* Nothing before the day closes: the trace lives only in this session,
          so no surface could honour a "GIF tomorrow" promise. The action
          returns on its own in the grace window (loaded before, solved after
          midnight UTC), where gifReady is already true. */}
      {gifReady && gifUrl && (
        <button
          type="button"
          onClick={onShareGif}
          className={`font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
            gifCopied ? "text-tape" : "text-paper/35 hover:text-paper/70"
          }`}
        >
          {gifCopied ? m.replay_gif_copied() : m.replay_gif()}
        </button>
      )}
    </div>
  );
}
