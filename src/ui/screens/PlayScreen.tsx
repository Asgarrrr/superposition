// The play screen: composes Hud, Board, rule line and Controls
// around useGame. Remounted (key) on every level change.

import { useCallback, useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";
import type { Level, Pos, TraceStep } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { ruleLine } from "../ruleLine.ts";
import { type Demo, levelDemo, pickDemo } from "../demos.ts";
import { guidedPlate, playingPlate } from "../plateDriver.ts";
import { Board } from "../components/Board.tsx";
import { Controls } from "../components/Controls.tsx";
import { Hud } from "../components/Hud.tsx";
import { LeftRail } from "../components/LeftRail.tsx";
import { DailyBoard } from "../components/DailyBoard.tsx";
import { getMyStreak } from "../../server/daily.ts";
import { LevelBoard } from "../components/LevelBoard.tsx";
import { Room } from "../components/Room.tsx";
import { WinOverlay } from "../components/WinOverlay.tsx";
import { DailyOverlay } from "../components/DailyOverlay.tsx";
import { DemoOverlay } from "../components/DemoOverlay.tsx";
import { useGuidedDemo, useSeenDemos } from "../hooks/useDemo.ts";
import { useGame } from "../hooks/useGame.ts";
import { useDailyClock } from "../hooks/useDiscoveryClock.ts";
import { useHold } from "../hooks/useHold.ts";
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

// ── the chrome band under the board ──────────────────────────────
// The whole screen is a vertically centred column, so a row down here that hugs
// its content drags the BOARD with it every time that content changes: the tip
// swapping between 1, 2 and 3 lines, a flash replacing it, the hint row emptying
// on the win. So both rows are SLOTS with a fixed height, never a min: the band
// measures the same whatever it holds, the grid's height is constant, and the
// centring never re-runs. The heights are the measured worst cases for the longest
// tip (`rule_fusion_merged`, 128 chars in BOTH locales) at 11.5px/17.25px type: its
// box is `min(100vw - 32px, 500px)`, which wraps to 4 lines at 288px (a 320px phone)
// and 3 lines from 343px up — hence 69px below `sm`, 52px from `sm` up.
// Measure these on the REAL element, never on a detached clone: the mono face comes
// from `font-mono` on the screen root, so a clone parented to <body> wraps with a
// narrower fallback font and under-reports the line count.
// The tip stays top-aligned (a plain block, no flex) so its first line keeps a
// fixed distance from the board it captions — the slack falls below it.
const tipSlot =
  "mt-3.5 h-[69px] max-w-[500px] text-center text-[11.5px] tracking-[0.02em] text-paper/55 sm:h-[52px]";
const actionSlot = "mt-3 flex h-[30px] items-center gap-3";

// The two discovery affordances (ask for a hint, replay the tutorial). They were
// bare text at /30 — 2.46:1, a 44×17 target — sitting beside two real buttons, so
// they read as ambient print rather than something you can press. A chip keeps
// them quieter than `.btn` (undo/reset keep the weight) while being bordered,
// legible at /55 and 30px tall, which clears the 24×24 target minimum.
const chip =
  "rounded-xs border border-paper/18 px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.06em] transition-colors hover:border-paper/35";

/** Daily mode: one tier of the day's challenge, played for the shared
 *  per-tier leaderboard rather than the campaign. Swaps the HUD banner and the
 *  win overlay. `tier` is 0 easy · 1 medium · 2 hard. */
export interface DailyMode {
  date: string;
  tier: number;
  optimal: number;
  /** When the server handed this player the grid — the anchor the ranked
   *  discovery time is measured from. Null when signed out: nothing was
   *  anchored, so nothing is clocked. Display only; the ranked value is
   *  recomputed server-side at submission and never read back from here. */
  servedAt: string | null;
  /** The server's clock when it replied, so the on-screen counter can offset a
   *  client clock that disagrees instead of trusting it. */
  serverNow: string;
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
  onHintedWin,
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
  onWin?: (moves: number, trace: TraceStep[], clean: boolean) => void; // clean = no undo/reset in the run
  onHintedWin?: () => void; // won with a hint: off the record, still marked solved
  onNext?: (() => void) | null;
  onExit: () => void;
  daily?: DailyMode;
}) {
  const game = useGame(level, fx, onWin, onHintedWin);
  // The daily's discovery clock: one reading, plus the callback the rail
  // reports the caller's standing through. The three-state reconciliation
  // behind it (no answer yet / ranked but unmeasured / measured) lives in the
  // hook, where it is tested.
  const { clock, onStanding } = useDailyClock(daily, game.solved);

  // The current daily streak, for the discreet reminder on the win overlay.
  // Fetched once the daily is solved. We pass the solved puzzle's date so the
  // server optimistically credits it even if the rail's score submit hasn't
  // landed yet — without inflating the run by crediting the server's "today".
  // Zero when signed out.
  const [streak, setStreak] = useState(0);
  const solvedDate = daily && game.solved ? daily.date : null;
  useEffect(() => {
    if (!solvedDate) return;
    let alive = true;
    getMyStreak({ data: { solved: solvedDate } })
      .then((s) => alive && setStreak(s.current))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [solvedDate]);

  // First-encounter tutorial: on the level's first newest-mechanic, the player
  // performs its signature gesture on rails on the ideal sandbox, captured at
  // mount (the screen remounts per level). Daily mode is expert — no demos.
  const { seen, markSeen } = useSeenDemos();
  const [demo, setDemo] = useState<Demo | null>(() =>
    daily ? null : pickDemo(level, seen),
  );
  const onDemoDone = useCallback(() => {
    setDemo((d) => {
      if (d) markSeen(d.id);
      return null;
    });
  }, [markSeen]);
  const guided = useGuidedDemo(demo, fx, onDemoDone);
  const replayDemo = daily ? null : levelDemo(level);

  // Who is driving the plate. The tutorial takes the table while it runs, then
  // hands it back — and that is the ONLY place the question is asked: everything
  // below (the board, the gestures, the controls) talks to one driver, so the
  // two boards can no longer drift apart. See plateDriver.ts for the mapping,
  // which is where the maintien-slide, the swipe's alt and the corrections rules
  // now live — and where they are tested.
  const driver =
    guidedPlate(guided) ?? playingPlate(game, level, onNext ?? null);

  // the direction the finger is aiming mid-slide, so the split preview can
  // narrow to the move about to fire (cleared on release inside useSwipe)
  const [aim, setAim] = useState<Pos | null>(null);
  const swipe = useSwipe(driver.swipe, {
    onHold: driver.hold,
    onAim: (d) => setAim(driver.previewsAim ? d : null),
  });

  const resetHold = useHold(driver.reset);

  useKeyboard({
    play: driver.press,
    undo: driver.undo,
    resetDown: resetHold.start,
    resetUp: resetHold.cancel,
    toggleAlt: driver.toggleArm,
    exit: onExit,
    next: () => driver.advance?.(),
  });

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center-safe px-4 pt-20 pb-[calc(2.5rem_+_env(safe-area-inset-bottom))] font-mono text-paper select-none xl:py-10">
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
          clock={clock}
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

        {/* ONE board, whoever is driving. The tutorial runs through the very same
            component the game does — a title card names the mechanic, marching
            arrows draw each gesture, and every payoff waits for the player: a tap
            anywhere, an arrow, or Enter continues. A tap only advances where the
            driver says it should, so on a real plate a stray one can't spend the
            win. */}
        <motion.div
          className="xl:col-start-2 xl:row-start-2 xl:pt-4"
          variants={vBoard}
          onClick={driver.tapAdvance ?? undefined}
        >
          <Board
            level={driver.level}
            st={driver.st}
            solved={driver.solved}
            bump={driver.bump}
            bloom={driver.bloom}
            armed={driver.armed}
            aim={driver.previewsAim ? aim : null}
            demo={driver.framed}
            guideGhosts={driver.guideGhosts}
            guides={driver.guides}
            iceTrailA={driver.iceTrailA}
            iceTrailB={driver.iceTrailB}
            {...swipe}
          >
            {driver.sandbox ? (
              <DemoOverlay
                phase={guided.phase}
                title={demo?.title() ?? ""}
                sub={demo?.sub() ?? ""}
                caption={guided.caption}
                nudge={guided.nudge}
                waiting={guided.waiting}
              />
            ) : (
              game.solved &&
              (daily ? (
                <DailyOverlay
                  level={level}
                  date={daily.date}
                  tier={daily.tier}
                  moves={game.moves}
                  optimal={daily.optimal}
                  streak={streak}
                  trace={game.solve?.trace}
                />
              ) : (
                <WinOverlay
                  plate={plate}
                  moves={game.moves}
                  best={best}
                  hinted={game.hints > 0}
                  trace={game.solve?.trace}
                  onNext={onNext}
                />
              ))
            )}
          </Board>
        </motion.div>

        <motion.div
          className="flex flex-col items-center xl:col-start-2 xl:row-start-3"
          variants={vControls}
        >
          {/* Both modes render into the SAME two slots, so the tutorial's handoff
              to the real level doesn't jump either — the tip is simply empty while
              the demo owns the board (its captions live inside the Board). */}
          <div className={tipSlot}>
            {driver.sandbox ? null : game.flash ? (
              <span className="text-ink-magenta">{game.flash}</span>
            ) : game.hintNote ? (
              <span className="text-paper/55">{game.hintNote}</span>
            ) : (
              ruleLine(game.st, level)
            )}
          </div>

          <Controls
            altLabel={driver.altLabel}
            altArmed={driver.armed}
            onDir={driver.press}
            onToggleAlt={driver.toggleArm}
            onUndo={driver.undo}
            reset={resetHold}
            guiding={driver.sandbox}
            highlight={driver.highlight}
          />

          <div className={actionSlot}>
            {driver.sandbox ? (
              guided.phase !== "handoff" && (
                <button
                  type="button"
                  onClick={guided.skip}
                  className={`${chip} text-paper/55 hover:text-paper/80`}
                >
                  {m.demo_skip()}
                </button>
              )
            ) : (
              <>
                {/* hint: campaign/free only. In daily its use can't be proven to
                    the server (a tampered client could strip it from the trace),
                    so hints are simply unavailable there rather than silently
                    unenforced. Peeking taints the run — it's off the record. */}
                {!daily && !game.solved && (
                  <button
                    type="button"
                    onClick={game.showHint}
                    className={`${chip} ${
                      game.hints > 0
                        ? "border-tape/40 text-tape/80 hover:text-tape"
                        : "text-paper/55 hover:text-paper/80"
                    }`}
                  >
                    {game.hints > 0
                      ? m.controls_hint_used({ count: game.hints })
                      : m.controls_hint()}
                  </button>
                )}
                {replayDemo && (
                  <button
                    type="button"
                    onClick={() => setDemo(replayDemo)}
                    className={`${chip} text-paper/55 hover:text-paper/80`}
                  >
                    {m.controls_demo()}
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>

        {daily ? (
          <DailyBoard
            date={daily.date}
            tier={daily.tier}
            solve={game.solve}
            onStanding={onStanding}
            className={boardRailClass}
            variants={vRightRail}
          />
        ) : (
          <LevelBoard
            levelId={level.id}
            solve={game.solve}
            className={boardRailClass}
            variants={vRightRail}
          />
        )}
      </motion.div>
    </div>
  );
}
