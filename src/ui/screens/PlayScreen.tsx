// The play screen: composes Hud, Board, rule line and Controls
// around useGame. Remounted (key) on every level change.

import { motion, type Variants } from "motion/react";
import type { Level } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { ruleLine } from "../ruleLine.ts";
import { Board } from "../components/Board.tsx";
import { Controls } from "../components/Controls.tsx";
import { Hud } from "../components/Hud.tsx";
import { LeftRail } from "../components/LeftRail.tsx";
import { DailyBoard } from "../components/DailyBoard.tsx";
import { LevelBoard } from "../components/LevelBoard.tsx";
import { Room } from "../components/Room.tsx";
import { WinOverlay } from "../components/WinOverlay.tsx";
import { DailyOverlay } from "../components/DailyOverlay.tsx";
import { useGame } from "../hooks/useGame.ts";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import type { SoundFx } from "../hooks/useSound.ts";
import { useSwipe } from "../hooks/useSwipe.ts";
import { PRINT_EASE, reducedMotion as reduced } from "../motion.ts";

// ── the develop-in ───────────────────────────────────────────────
// The board doesn't just pop in: each element of the composition makes its own
// entrance and they assemble around the board. The parent flips the shared
// hidden→visible label; every piece carries its own variant (with a baked-in
// delay, so the order is explicit and independent of DOM/stagger mechanics):
// the caption drops in, the board lifts + settles from a hair under size, then
// the two rails slide in from their outer edges and the controls come up last.
// Pieces receive their variant via `variants=`; the rails pass theirs down to a
// motion root (LeftRail / LeaderboardRail) so they animate without breaking the
// board-height subgrid a wrapper would.
const ease = (delay: number, duration = 0.5) =>
  ({ duration, ease: PRINT_EASE, delay }) as const;

const composition: Variants = { hidden: {}, visible: {} };

const vCaption: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: ease(0.04) },
};
const vBoard: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1, transition: ease(0.1, 0.62) },
};
const vLeftRail: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: ease(0.16) },
};
const vRightRail: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: ease(0.18) },
};
const vControls: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: ease(0.24) },
};

// The two rails flanking the board share one shape so it stays optically
// centred between them: two stacked subgrid rows the board's height, 220px wide
// on xl. Kept as one source so a tweak to either side can't silently drift.
const railShape =
  "xl:row-start-1 xl:row-span-2 xl:grid xl:w-[220px] xl:grid-rows-subgrid";
const leftRailClass = `w-[min(92vw,520px)] ${railShape} xl:col-start-1 xl:justify-self-end`;
const boardRailClass = `mt-8 w-[min(90vw,420px)] ${railShape} xl:col-start-3 xl:mt-0 xl:justify-self-start xl:self-stretch`;

/** Daily mode: one tier of the day's challenge, played for the shared
 *  per-tier leaderboard rather than the campaign. Swaps the HUD banner and the
 *  win overlay. `tier` is 0 easy · 1 medium · 2 hard. */
export interface DailyMode {
  date: string;
  tier: number;
  optimal: number;
}

export function PlayScreen({
  level,
  plate = 0,
  total = 0,
  best,
  fx,
  muted,
  onToggleMute,
  onWin,
  onNext = null,
  onExit,
  daily,
}: {
  level: Level;
  plate?: number; // level number, 1-based (campaign)
  total?: number;
  best?: number | undefined;
  fx: SoundFx;
  muted: boolean;
  onToggleMute: () => void;
  onWin?: (moves: number) => void;
  onNext?: (() => void) | null;
  onExit: () => void;
  daily?: DailyMode;
}) {
  const game = useGame(level, fx, onWin);
  const swipe = useSwipe(game.play);

  useKeyboard({
    play: game.play,
    undo: game.undo,
    reset: game.reset,
    toggleAlt: game.toggleAlt,
    exit: onExit,
    next: () => {
      if (game.solved) onNext?.();
    },
  });

  const altLabel = game.st.merged
    ? m.controls_split()
    : level.mods.includes("decalage")
      ? m.controls_world()
      : null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-10 font-mono text-paper select-none xl:py-10">
      {/* the shared lit table — the same workshop the title and edition sit in,
          so the board reads as a print on the table rather than a widget in a
          void (variant 0: the plain warm lamp, no halftone competing with the
          board) */}
      <Room variant={0} reduced={reduced} />

      {/* desktop: a three-column grid — an empty left counterweight, the hero
          column (board + its chrome), and the leaderboard — so the board stays
          the true optical centre instead of being shoved left by a rail bolted
          to its right. The Hud, board and controls occupy three explicit rows so
          the rail can share the board's row: their top edges line up and the
          rail stretches to the board's height, reading as one paired object
          rather than a panel floating up beside the title. Below xl it collapses
          to a single centred stack. This is also the develop-in root: it flips
          the shared hidden→visible label its children each animate against. */}
      <motion.div
        className="relative z-10 grid w-full max-w-6xl grid-cols-1 place-items-center gap-y-0 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:grid-rows-[auto_auto_auto] xl:items-start xl:gap-x-20"
        variants={composition}
        initial={reduced ? false : "hidden"}
        animate="visible"
      >
        {/* left rail — navigation, level progress, sound and the move readout.
            It mirrors the leaderboard: its nav shares the Hud's baseline rule
            (subgrid row 1), its stats sit at the board's row (row 2). Below xl
            the DOM order puts it first, so it becomes the top bar. */}
        <LeftRail
          plate={plate}
          total={total}
          moves={game.moves}
          record={daily ? undefined : best}
          muted={muted}
          onToggleMute={onToggleMute}
          onExit={onExit}
          daily={daily?.date}
          backLabel={daily ? m.hud_back() : undefined}
          className={leftRailClass}
          variants={vLeftRail}
        />

        {/* mobile: the title leads, so the nav bar drops below its separator,
            right above the board. On xl explicit grid placement ignores order. */}
        <motion.div
          className="order-first xl:order-none xl:col-start-2 xl:row-start-1"
          variants={vCaption}
        >
          <Hud level={level} daily={!!daily} dailyTier={daily?.tier} />
        </motion.div>

        <motion.div
          className="xl:col-start-2 xl:row-start-2 xl:pt-4"
          variants={vBoard}
        >
          <Board
            level={level}
            st={game.st}
            solved={game.solved}
            bump={game.bump}
            bloom={game.bloom}
            armed={game.altArmed}
            iceTrailA={game.iceTrailA}
            iceTrailB={game.iceTrailB}
            {...swipe}
          >
            {game.solved &&
              (daily ? (
                <DailyOverlay moves={game.moves} optimal={daily.optimal} />
              ) : (
                <WinOverlay
                  plate={plate}
                  moves={game.moves}
                  best={best}
                  onNext={onNext}
                />
              ))}
          </Board>
        </motion.div>

        <motion.div
          className="flex flex-col items-center xl:col-start-2 xl:row-start-3"
          variants={vControls}
        >
          <div className="mt-3.5 min-h-[30px] max-w-[500px] text-center text-[11.5px] tracking-[0.02em] text-paper/28">
            {game.flash ? (
              <span className="text-ink-magenta">{game.flash}</span>
            ) : (
              ruleLine(game.st, level)
            )}
          </div>

          <Controls
            altLabel={altLabel}
            altArmed={game.altArmed}
            onDir={game.play}
            onToggleAlt={game.toggleAlt}
            onUndo={game.undo}
            onReset={game.reset}
          />
        </motion.div>

        {daily ? (
          <DailyBoard
            date={daily.date}
            tier={daily.tier}
            solved={game.solved}
            moves={game.moves}
            wonTrace={game.wonTrace}
            className={boardRailClass}
            variants={vRightRail}
          />
        ) : (
          <LevelBoard
            levelId={level.id}
            solved={game.solved}
            moves={game.moves}
            wonTrace={game.wonTrace}
            className={boardRailClass}
            variants={vRightRail}
          />
        )}
      </motion.div>
    </div>
  );
}
