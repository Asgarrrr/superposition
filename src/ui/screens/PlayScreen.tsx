// The play screen: composes Hud, Board, rule line and Controls
// around useGame. Remounted (key) on every level change.

import { useCallback, useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";
import type { GameState, Input, Level, Pos } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { altGesture } from "../altGesture.ts";
import { ruleLine } from "../ruleLine.ts";
import { type Demo, levelDemo, pickDemo } from "../demos.ts";
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
import {
  type DemoCaption,
  useGuidedDemo,
  useSeenDemos,
} from "../hooks/useDemo.ts";
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

// the label for the state's alt gesture — the rule itself lives in altGesture.ts
const altLabelFor = (st: GameState, level: Level) => {
  switch (altGesture(st, level)) {
    case "split":
      return m.controls_split();
    case "shift":
      return m.controls_world();
    case null:
      return null;
  }
};

// The hint spotlights the control to press next in two beats, mirroring the
// guided demo (useDemo's `guidance`): a split/world hint lights ONLY the arm
// control until the state is armed, then the arrow. Lighting both at once let a
// bare arrow press slip through as an ordinary move — the hint pointing at a
// gesture the press didn't perform.
const hintHighlight = (
  hint: Input | null,
  armed: boolean,
): { arm: boolean; dir: Pos | null } | undefined => {
  if (!hint) return undefined;
  return hint.kind !== "move" && !armed
    ? { arm: true, dir: null }
    : { arm: false, dir: hint.dir };
};

// the caption speaks in four voices; keep the mapping exhaustive and visible
const captionTone: Record<DemoCaption["kind"], string> = {
  say: "text-paper/85",
  done: "text-tape",
  hint: "text-ink-magenta",
  hand: "text-tape",
};

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
  onWin?: (moves: number) => void;
  onHintedWin?: () => void; // won with a hint: off the record, still marked solved
  onNext?: (() => void) | null;
  onExit: () => void;
  daily?: DailyMode;
}) {
  const game = useGame(level, fx, onWin, onHintedWin);

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
  const demoActive = guided.active;
  const replayDemo = daily ? null : levelDemo(level);

  // during the tutorial the real controls drive the sandbox on rails
  const play = (d: Pos, alt = false) => {
    if (demoActive) return guided.press(d, alt);
    game.play(d, alt);
  };
  const toggleAlt = () => (demoActive ? guided.arm() : game.toggleAlt());
  const swipe = useSwipe(play);

  useKeyboard({
    play,
    undo: () => !demoActive && game.undo(),
    reset: () => !demoActive && game.reset(),
    toggleAlt,
    exit: onExit,
    next: () => {
      if (demoActive) return guided.next(); // Enter continues the tutorial
      if (game.solved) onNext?.();
    },
  });

  const altLabel = altLabelFor(game.st, level);
  // the alt control the tutorial expects, from the sandbox state/mechanic
  const guidedAltLabel =
    guided.st && demo ? altLabelFor(guided.st, demo.level) : null;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 pt-20 pb-[calc(2.5rem_+_env(safe-area-inset-bottom))] font-mono text-paper select-none xl:py-10">
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
          {demoActive && guided.st && guided.level ? (
            // the tutorial runs through the real Board; the player drives it on
            // rails. A title card names the mechanic, marching arrows draw each
            // gesture, and every payoff waits for the player: a tap anywhere,
            // an arrow, or Enter continues. On handoff the tape frame fades
            // before the real level develops in.
            <div onClick={guided.next}>
              <Board
                demo={guided.phase !== "handoff"}
                level={guided.level}
                st={guided.st}
                solved={false}
                bump={guided.bump}
                bloom={guided.bloom}
                armed={guided.armed}
                guideGhosts={guided.ghosts}
                guides={guided.guides}
                iceTrailA={null}
                iceTrailB={null}
                {...swipe}
              >
                {guided.phase === "title" ? (
                  // the mechanic's name arrives like the win screen's "Bon à
                  // tirer": an amber stamp slammed onto the veiled print
                  <motion.div
                    className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-room/45"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35, ease: PRINT_EASE }}
                  >
                    <span className="rounded-xs border border-tape/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-tape/90">
                      {m.controls_demo_tag()}
                    </span>
                    <div
                      className="sp-stamped rounded-sm border-[2.5px] border-tape px-5 py-2.5 font-mono text-[19px] tracking-[0.26em] text-tape uppercase"
                      style={{ animationDelay: "250ms" }}
                    >
                      {demo?.title()}
                    </div>
                    <span className="mt-1 font-display text-[17px] text-paper/75">
                      {demo?.sub()}
                    </span>
                    <span className="mt-3 animate-pulse font-mono text-[11px] tracking-[0.14em] text-tape/80 uppercase">
                      {m.demo_continue()}
                    </span>
                  </motion.div>
                ) : (
                  guided.caption && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
                      <div
                        // remount on each refusal so the headshake retriggers
                        key={guided.nudge?.t ?? "still"}
                        className={`flex max-w-[92%] flex-col items-center gap-1 rounded-xs px-3.5 py-2 text-center font-display text-[16px] leading-snug tracking-[0.01em] ${
                          guided.nudge ? "sp-nudge" : ""
                        } ${captionTone[guided.caption.kind]}`}
                        style={{ background: "rgba(18,16,14,0.78)" }}
                      >
                        <div className="flex items-center gap-2">
                          {guided.caption.kind === "say" && (
                            <span className="shrink-0 rounded-xs border border-tape/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-tape/90">
                              {m.controls_demo_tag()}
                            </span>
                          )}
                          {guided.caption.text}
                        </div>
                        {guided.waiting && (
                          <span className="animate-pulse font-mono text-[11px] tracking-[0.14em] text-tape/80 uppercase">
                            {m.demo_continue()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}
              </Board>
            </div>
          ) : (
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
                ))}
            </Board>
          )}
        </motion.div>

        <motion.div
          className="flex flex-col items-center xl:col-start-2 xl:row-start-3"
          variants={vControls}
        >
          {demoActive ? (
            <>
              <div className="mt-3.5 min-h-[30px]" />
              <Controls
                altLabel={guidedAltLabel}
                altArmed={guided.armed}
                onDir={play}
                onToggleAlt={toggleAlt}
                onUndo={() => {}}
                onReset={() => {}}
                guiding
                highlight={guided.guidance}
              />
              {guided.phase !== "handoff" && (
                <button
                  type="button"
                  onClick={guided.skip}
                  className="mt-3 font-mono text-[11px] tracking-[0.06em] text-paper/30 transition-colors hover:text-paper/60"
                >
                  {m.demo_skip()}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="mt-3.5 min-h-[30px] max-w-[500px] text-center text-[11.5px] tracking-[0.02em] text-paper/28">
                {game.flash ? (
                  <span className="text-ink-magenta">{game.flash}</span>
                ) : game.hintNote ? (
                  <span className="text-paper/55">{game.hintNote}</span>
                ) : (
                  ruleLine(game.st, level)
                )}
              </div>

              <Controls
                altLabel={altLabel}
                altArmed={game.altArmed}
                onDir={play}
                onToggleAlt={game.toggleAlt}
                onUndo={game.undo}
                onReset={game.reset}
                highlight={hintHighlight(game.hint, game.altArmed)}
              />

              <div className="mt-3 flex items-center gap-5">
                {/* hint: campaign/free only. In daily its use can't be proven to
                    the server (a tampered client could strip it from the trace),
                    so hints are simply unavailable there rather than silently
                    unenforced. Peeking taints the run — it's off the record. */}
                {!daily && !game.solved && (
                  <button
                    type="button"
                    onClick={game.showHint}
                    className={`font-mono text-[11px] tracking-[0.06em] transition-colors ${
                      game.hints > 0
                        ? "text-tape/70 hover:text-tape"
                        : "text-paper/30 hover:text-paper/60"
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
                    className="font-mono text-[11px] tracking-[0.06em] text-paper/30 transition-colors hover:text-paper/60"
                  >
                    {m.controls_demo()}
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>

        {daily ? (
          <DailyBoard
            date={daily.date}
            tier={daily.tier}
            solve={game.solve}
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
