// The player's page: their name, the series of four stamps, the register strip
// of figures, the daily grid and the campaign edition — composed as a single lit
// proof-sheet on the workshop table. The name is printed in two mis-registered
// inks (the game's own motif), the distinctions are printed as a philatelic
// series (see components/Stamp.tsx), and the two halves of the game — the daily
// and the edition — each get a section under a rule.
//
// Presentational: the /profile routes own the session gate and the history fetch
// and hand a resolved history down. Every rule about tiers lives in
// lib/distinctions.ts; this screen only lays out what it is given.

import { useEffect } from "react";
import { motion, type Variants } from "motion/react";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { computeStreaks } from "../../lib/streak.ts";
import { distinctions } from "../../lib/distinctions.ts";
import { LEVELS } from "../../engine/levels.ts";
import { PAR } from "../../engine/par.ts";
import { Room } from "../components/Room.tsx";
import { LangToggle } from "../components/LangToggle.tsx";
import { ContributionGraph } from "../components/ContributionGraph.tsx";
import { Stamp } from "../components/Stamp.tsx";
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

// framer-motion serialises `initial` into the SSR HTML: with "hidden" the server
// ships the sheet (and, via variant propagation, its children) at opacity 0, so a
// human sees a blank page until hydration. This route is the only one rendered
// server-side, so the server mount — and the first client render that hydrates it
// — must start already visible (`initial={false}`); only later client-side
// navigations to a profile play the entrance. The flag sits at module scope,
// which resets per server request, so SSR always takes the visible branch and the
// hydrating render matches it (no mismatch, no reduced-motion flash either since
// the branch no longer depends on `reduced`). An effect flips it once mounted.
let hydrated = false;

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

function SectionRule({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 text-[10px] tracking-[0.3em] text-paper/28 uppercase">
      <span className="tracking-[0.28em] text-paper/45">{title}</span>
      <span className="flex-1 border-b border-paper/12" />
    </div>
  );
}

/** The 22 campaign plates, one row per chapter, in the edition's own order. A
 *  plate pulled at the solver's optimum AND without a correction wears the ink
 *  frame — the same mark, and the same class, the edition screen uses. */
function EditionPlates({ plates }: { plates: DailyHistory["plates"] }) {
  const byId = new Map(plates.map((p) => [p.levelId, p]));
  const chapters = [...new Set(LEVELS.map((lv) => lv.ch))];
  return (
    <div className="flex flex-col gap-1.5">
      {chapters.map((ch) => (
        <div key={ch} className="flex flex-wrap gap-1.5">
          {LEVELS.filter((lv) => lv.ch === ch).map((lv) => {
            const rec = byId.get(lv.id);
            const par = PAR[lv.id];
            const sealed =
              rec !== undefined &&
              par !== undefined &&
              rec.moves <= par &&
              rec.undos === 0;
            return (
              <span
                key={lv.id}
                title={rec ? `${lv.name} · ${rec.moves}` : lv.name}
                className={`h-[19px] w-[26px] rounded-[2px] border ${
                  sealed
                    ? "sp-ink-frame border-transparent"
                    : rec
                      ? "border-tape/50 bg-tape/[0.09]"
                      : "border-paper/14"
                }`}
              />
            );
          })}
        </div>
      ))}
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
  // true on the server render and the client render that hydrates it, false on
  // every subsequent client navigation — gates the entrance animation (below).
  const firstMount = !hydrated;
  useEffect(() => {
    hydrated = true;
  }, []);

  const streaks = computeStreaks(
    history.days.map((d) => d.date),
    today,
  );
  const marks = distinctions(history.marks);
  const bat = marks.find((d) => d.family === "maitrise")!.count;
  const since = new Intl.DateTimeFormat(getLocale(), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${history.joinedAt}T00:00:00Z`));

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-16 font-mono text-paper select-none">
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
        initial={firstMount || reduced ? false : "hidden"}
        animate="visible"
        className="relative z-10 w-[min(94vw,860px)] overflow-hidden rounded-sm border border-paper/10 px-7 py-9 sm:px-12 sm:py-12"
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

        {/* the series — four stamps, or the empty mounts where they will go */}
        <motion.div
          variants={rise}
          className="mt-9 flex flex-wrap items-start justify-center gap-3 sm:gap-5"
        >
          {marks.map((d) => (
            <Stamp key={d.family} distinction={d} />
          ))}
        </motion.div>

        {/* register strip — two figures of presence, two of quality */}
        <motion.div
          variants={rise}
          className="mt-9 mb-8 flex items-stretch justify-center divide-x divide-paper/10"
        >
          <Stat
            value={streaks.current}
            label={m.profile_streak_current()}
            accent
          />
          <Stat value={streaks.total} label={m.profile_total()} />
          <Stat value={bat} label={m.profile_bat_total()} />
          <Stat value={history.cleanCount} label={m.profile_clean_total()} />
        </motion.div>

        {/* the daily — the grid is always shown, an empty year reads as a
            timeline waiting to be filled, not a dead end */}
        <motion.div variants={rise}>
          <SectionRule title={m.profile_grid_title()} />
          <ContributionGraph history={history} today={today} />
          {history.days.length === 0 && (
            <p className="mt-4 text-center text-[12px] text-paper/40">
              {m.profile_empty()}
            </p>
          )}
        </motion.div>

        {/* the edition — the other half of the game, absent from this page until
            now even though the server has always known it */}
        <motion.div variants={rise} className="mt-9">
          <SectionRule
            title={`${m.profile_edition_title()} · ${m.profile_plates_of({
              done: history.plates.length,
              all: LEVELS.length,
            })}`}
          />
          <EditionPlates plates={history.plates} />
        </motion.div>
      </motion.section>
    </div>
  );
}
