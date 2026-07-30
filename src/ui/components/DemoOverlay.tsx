// What the tutorial draws ON the sandbox board: the title card that names the
// mechanic, and the caption that instructs, pays off, or invites another try.
// Lifted out of PlayScreen so the screen renders ONE board whose children are a
// single choice — the tutorial's overlay, or the win — rather than two boards
// kept in step by hand.

import { motion } from "motion/react";
import { m } from "../../paraglide/messages.js";
import type { DemoCaption, DemoPhase } from "../hooks/useDemo.ts";
import type { Pulse } from "../hooks/useGame.ts";
import { PRINT_EASE, reducedMotion as reduced } from "../motion.ts";

// the caption speaks in four voices; keep the mapping exhaustive and visible
const captionTone: Record<DemoCaption["kind"], string> = {
  say: "text-paper/85",
  done: "text-tape",
  hint: "text-ink-magenta",
  hand: "text-tape",
};

function DemoTag() {
  return (
    <span className="shrink-0 rounded-xs border border-tape/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-tape/90">
      {m.controls_demo_tag()}
    </span>
  );
}

function ContinuePrompt({ className = "" }: { className?: string }) {
  return (
    <span
      className={`animate-pulse font-mono text-[11px] tracking-[0.14em] text-tape/80 uppercase ${className}`}
    >
      {m.demo_continue()}
    </span>
  );
}

export function DemoOverlay({
  phase,
  title,
  sub,
  caption,
  nudge,
  waiting,
}: {
  phase: DemoPhase;
  title: string;
  sub: string;
  caption: DemoCaption | null;
  nudge: Pulse | null; // a refused input: retrigger the headshake
  waiting: boolean; // a payoff is on screen; the player continues at their pace
}) {
  // the mechanic's name arrives like the win screen's "Bon à tirer": an amber
  // stamp slammed onto the veiled print
  if (phase === "title")
    return (
      <motion.div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-room/45"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: PRINT_EASE }}
      >
        <DemoTag />
        <div
          className="sp-stamped rounded-sm border-[2.5px] border-tape px-5 py-2.5 font-mono text-[19px] tracking-[0.26em] text-tape uppercase"
          style={{ animationDelay: "250ms" }}
        >
          {title}
        </div>
        <span className="mt-1 font-display text-[17px] text-paper/75">
          {sub}
        </span>
        <ContinuePrompt className="mt-3" />
      </motion.div>
    );

  if (!caption) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
      <div
        // remount on each refusal so the headshake retriggers
        key={nudge?.t ?? "still"}
        className={`flex max-w-[92%] flex-col items-center gap-1 rounded-xs px-3.5 py-2 text-center font-display text-[16px] leading-snug tracking-[0.01em] ${
          nudge ? "sp-nudge" : ""
        } ${captionTone[caption.kind]}`}
        style={{ background: "rgba(18,16,14,0.78)" }}
      >
        <div className="flex items-center gap-2">
          {caption.kind === "say" && <DemoTag />}
          {caption.text}
        </div>
        {waiting && <ContinuePrompt />}
      </div>
    </div>
  );
}
