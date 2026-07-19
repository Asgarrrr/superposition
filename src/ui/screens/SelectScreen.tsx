// Selection: the full edition, level by level, chapter by chapter.

import { motion } from "motion/react";
import { LEVELS } from "../../engine/levels.ts";
import { m } from "../../paraglide/messages.js";
import { chapterName } from "../copy.ts";
import { Wordmark } from "../components/Wordmark.tsx";
import { LangToggle } from "../components/LangToggle.tsx";
import { Room } from "../components/Room.tsx";
import { RevealOverlay } from "./RevealOverlay.tsx";
import { PRINT_EASE, reducedMotion as reduced } from "../motion.ts";

// the develop-in: header then plates rise and surface in sequence, so the
// edition reads as a print coming up on the table rather than a static list
const column = {
  hidden: {},
  visible: { transition: { delayChildren: 0.3, staggerChildren: 0.06 } },
};
const plates = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: PRINT_EASE },
  },
};

// `reveal` (set when arriving from the enter screen) opens the selector out of
// the same white flood the enter screen ends on: the halftone rosette resolves
// while the edition develops in underneath, so the route swap reads as one
// continuous gesture. False on a plain return — then it renders at rest.

export function SelectScreen({
  best,
  hinted = {},
  onPick,
  onDaily,
  onProfile,
  signedIn = false,
  reveal = false,
  weekendReady = false,
}: {
  best: Record<string, number>;
  // levels cleared with a hint (off the record) — a dim ✓, no move count
  hinted?: Record<string, true>;
  onPick: (idx: number) => void;
  onDaily: (tier: number) => void;
  onProfile: () => void;
  // a signed-in player gets a link to their own page; anonymous play hides it
  signedIn?: boolean;
  reveal?: boolean;
  // the server confirmed today's weekend épreuve exists — only then is the plate
  // shown, so a click never dead-ends back to the selector
  weekendReady?: boolean;
}) {
  const play = reveal && !reduced;
  const tierLabels = [m.daily_tier_0(), m.daily_tier_1(), m.daily_tier_2()];
  return (
    <div className="relative min-h-dvh font-mono text-paper select-none">
      {/* the shared lit table, behind the scrolling edition (variant 0: the
          plain warm lamp, same as the board) */}
      <Room variant={0} reduced={reduced} />

      {play && <RevealOverlay />}
      <LangToggle className="absolute top-4 right-4 z-20" />
      {signedIn && (
        <button
          type="button"
          onClick={onProfile}
          className="absolute top-4 left-4 z-20 cursor-pointer text-[11px] tracking-[0.2em] text-paper/40 uppercase transition-colors hover:text-paper/70"
        >
          {m.profile_link()}
        </button>
      )}

      <motion.div
        className="relative z-10 flex min-h-dvh flex-col items-center px-4 pt-11 pb-16"
        variants={column}
        initial={play ? "hidden" : false}
        animate="visible"
      >
        <motion.div variants={rise} className="mb-1.5 origin-center scale-55">
          <Wordmark aligned />
        </motion.div>
        <motion.div
          variants={rise}
          className="mb-7.5 text-[10px] tracking-[0.4em] text-paper/28 uppercase"
        >
          {m.select_edition({ count: LEVELS.length })}
        </motion.div>

        {/* défi du jour — three tiers of the day at rising difficulty, each its
          own shared leaderboard. Framed like a set of the edition (a divider
          header, plates in the same family as the levels) rather than a loud
          pasted-on box: the only masking-tape here is the title, so the accent
          stays the rare one the DA calls for. */}
        <motion.div variants={rise} className="mb-9 w-[min(92vw,420px)]">
          <div className="mb-2.5 flex items-baseline gap-2.5 text-[10px] tracking-[0.3em] text-paper/28 uppercase">
            <span className="tracking-[0.28em] text-tape/90">
              {m.daily_challenge_title()}
            </span>
            <span className="flex-1 border-b border-paper/12" />
            <span className="font-display text-[15px] normal-case italic tracking-[0.02em] text-paper/50">
              {m.daily_challenge_sub()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {tierLabels.map((label, t) => (
              <button
                key={t}
                type="button"
                className="group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xs border border-paper/12 bg-paper/[0.015] py-3 text-center transition-colors duration-200 hover:border-paper/25 hover:bg-paper/[0.045]"
                onClick={() => onDaily(t)}
              >
                {/* same register tick as the level plates */}
                <span className="absolute top-1/2 left-0 h-0 w-px -translate-y-1/2 bg-tape/70 transition-all duration-200 group-hover:h-5" />
                <span className="font-display text-sm italic tracking-[0.02em] text-paper/85 transition-colors duration-200 group-hover:text-paper">
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* the weekend épreuve d'artiste — a full-width plate below the three,
              in the printer's masking-tape gold rather than the tiers' paper, so
              it reads at a glance as a rank above them. Weekend-only. */}
          {weekendReady && (
            <button
              type="button"
              onClick={() => onDaily(3)}
              className="group relative mt-2 flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xs border border-tape/40 px-4 py-4 text-left transition-colors duration-200 hover:border-tape/70"
              style={{
                // a lit sheet, not a flat rectangle: a warm lamp catches the top
                // corner and a hairline lip picks up the light
                background:
                  "radial-gradient(150% 170% at 14% -30%, rgba(232,184,75,0.12), rgba(232,184,75,0.035) 62%)",
                boxShadow: "inset 0 1px 0 rgba(242,237,228,0.06)",
              }}
            >
              {/* the proof mark pressed into the sheet — large and faint, struck
                  a touch askew the way an artist's proof is hand-stamped */}
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 -rotate-[6deg] font-display text-[58px] leading-none italic text-tape/[0.09] transition-colors duration-200 select-none group-hover:text-tape/[0.15]"
              >
                {m.daily_ea_mark()}
              </span>
              <span
                className="relative z-[1] flex-1 font-display text-[17px] italic tracking-[0.02em] text-tape"
                style={{ textShadow: "0 1px 12px rgba(20,17,14,0.5)" }}
              >
                {m.daily_tier_3()}
              </span>
              <svg
                viewBox="0 0 24 24"
                className="relative z-[1] h-4 w-4 shrink-0 text-tape/50 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          )}
        </motion.div>

        <motion.div
          variants={plates}
          className="flex w-[min(92vw,420px)] flex-col gap-2"
        >
          {LEVELS.map((lv, i) => (
            <motion.div variants={rise} key={lv.id} className="flex flex-col">
              {(i === 0 || lv.ch !== LEVELS[i - 1].ch) && (
                <div className="mx-0 mt-4 mb-2 flex items-baseline gap-2.5 text-[10px] tracking-[0.3em] text-paper/28 uppercase">
                  <span>{m.select_set({ ch: lv.ch })}</span>
                  <span className="flex-1 border-b border-paper/12" />
                  <span className="font-display text-[15px] normal-case italic tracking-[0.02em] text-paper/50">
                    {chapterName(lv.ch)}
                  </span>
                </div>
              )}
              <button
                type="button"
                className="group relative flex cursor-pointer items-center gap-3.5 overflow-hidden rounded-xs border border-paper/12 bg-paper/[0.015] px-3.5 py-3 text-left transition-colors duration-200 hover:border-paper/25 hover:bg-paper/[0.045]"
                onClick={() => onPick(i)}
              >
                {/* register tick — a slot mark on the sheet's edge that grows as
                  the plate comes into register under the pointer */}
                <span className="absolute top-1/2 left-0 h-0 w-px -translate-y-1/2 bg-tape/70 transition-all duration-200 group-hover:h-5" />
                <span className="w-6 text-[11px] tabular-nums text-paper/28 transition-colors duration-200 group-hover:text-tape">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-display text-[15px] italic tracking-[0.02em] text-paper/90 transition-colors duration-200 group-hover:text-paper">
                  {lv.name}
                </span>
                {best[lv.id] !== undefined ? (
                  <span className="text-[10px] tracking-[0.1em] text-tape tabular-nums">
                    ✓ {best[lv.id]}
                  </span>
                ) : (
                  // solved with a hint but never on the record: a dim mark, no
                  // count and no amber — it reads as done without claiming a record
                  hinted[lv.id] && (
                    <span className="text-[10px] tracking-[0.1em] text-paper/40 tabular-nums">
                      ✓
                    </span>
                  )
                )}
              </button>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
