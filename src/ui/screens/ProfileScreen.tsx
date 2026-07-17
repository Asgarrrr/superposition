// The player's page: their name, streak figures and daily contribution grid,
// composed as a single lit proof-sheet on the workshop table — the name printed
// in two mis-registered inks (the game's own motif), a register strip of stats,
// and the grid framed under a section rule. Presentational: the /profile routes
// own the session gate and the history fetch and hand a resolved history down.

import { motion, type Variants } from "motion/react";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { computeStreaks } from "../../lib/streak.ts";
import { Room } from "../components/Room.tsx";
import { LangToggle } from "../components/LangToggle.tsx";
import { ContributionGraph } from "../components/ContributionGraph.tsx";
import { PRINT_EASE, reducedMotion as reduced } from "../motion.ts";
import type { DailyHistory } from "../../server/profile.ts";

const sheet: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, delayChildren: 0.15, staggerChildren: 0.09 },
  },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: PRINT_EASE },
  },
};

// the name pulled twice, cyan then magenta, a hair out of register — the same
// print the wordmark makes, so a player's page carries the game's signature
function InkName({ name }: { name: string }) {
  const ink = (color: string, dx: number, dy: number) => ({
    position: "absolute" as const,
    inset: 0,
    color,
    mixBlendMode: "screen" as const,
    transform: `translate(${dx}px, ${dy}px)`,
  });
  return (
    <div className="relative font-display text-5xl leading-none italic sm:text-6xl">
      <span style={ink("var(--color-ink-cyan)", -1.5, -1)}>{name}</span>
      <span style={ink("var(--color-ink-magenta)", 1.5, 1)}>{name}</span>
      <span className="invisible">{name}</span>
    </div>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 px-3">
      <span
        className={`font-display text-4xl leading-none tabular-nums sm:text-[2.75rem] ${
          accent ? "text-tape" : "text-paper"
        }`}
      >
        {value}
      </span>
      <span className="text-center text-[9px] tracking-[0.26em] text-paper/35 uppercase">
        {label}
      </span>
    </div>
  );
}

export function ProfileScreen({
  history,
  today,
  onBack,
}: {
  history: DailyHistory;
  today: string;
  onBack: () => void;
}) {
  const streaks = computeStreaks(
    history.days.map((d) => d.date),
    today,
  );
  const since = new Intl.DateTimeFormat(getLocale(), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${history.joinedAt}T00:00:00Z`));

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16 font-mono text-paper select-none">
      <Room variant={0} reduced={reduced} />
      <LangToggle className="absolute top-4 right-4 z-20" />
      <button
        type="button"
        onClick={onBack}
        className="absolute top-4 left-4 z-20 cursor-pointer text-[11px] tracking-[0.2em] text-paper/40 uppercase transition-colors hover:text-paper/70"
      >
        ← {m.daily_back()}
      </button>

      <motion.section
        variants={sheet}
        initial={reduced ? false : "hidden"}
        animate="visible"
        className="relative z-10 w-[min(94vw,620px)] overflow-hidden rounded-sm border border-paper/10 px-7 py-9 sm:px-12 sm:py-12"
        style={{
          background:
            "radial-gradient(125% 130% at 50% -12%, var(--color-box-glow), var(--color-box) 58%, #17130f)",
          boxShadow:
            "inset 0 1px 0 rgba(242,237,228,0.05), 0 26px 64px -34px rgba(0,0,0,0.85)",
        }}
      >
        {/* masthead — the colophon of the sheet */}
        <motion.header variants={rise} className="flex flex-col items-center">
          <span className="mb-3 text-[10px] tracking-[0.42em] text-tape/80 uppercase">
            {m.profile_title()}
          </span>
          <InkName name={history.name} />
          <span className="mt-3.5 font-display text-[15px] tracking-[0.02em] text-paper/40 italic">
            {m.profile_member_since({ since })}
          </span>
        </motion.header>

        {/* register strip — the three figures, streak struck in tape */}
        <motion.div
          variants={rise}
          className="mt-9 mb-8 flex items-stretch justify-center divide-x divide-paper/10"
        >
          <Stat
            value={streaks.current}
            label={m.profile_streak_current()}
            accent
          />
          <Stat value={streaks.longest} label={m.profile_streak_longest()} />
          <Stat value={streaks.total} label={m.profile_total()} />
        </motion.div>

        {/* section rule + the grid, in the same idiom as the edition's SET rules */}
        <motion.div variants={rise}>
          <div className="mb-4 flex items-center gap-3 text-[10px] tracking-[0.3em] text-paper/28 uppercase">
            <span className="tracking-[0.28em] text-paper/45">
              {m.profile_grid_title()}
            </span>
            <span className="flex-1 border-b border-paper/12" />
          </div>
          {history.days.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-paper/40">
              {m.profile_empty()}
            </p>
          ) : (
            <ContributionGraph history={history} today={today} />
          )}
        </motion.div>
      </motion.section>
    </div>
  );
}
