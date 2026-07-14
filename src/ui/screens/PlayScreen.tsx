// The play screen: composes Hud, Board, rule line and Controls
// around useGame. Remounted (key) on every level change.

import type { Input, Level } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { ruleLine } from "../ruleLine.ts";
import { Board } from "../components/Board.tsx";
import { Controls } from "../components/Controls.tsx";
import { Hud } from "../components/Hud.tsx";
import { LevelBoard } from "../components/LevelBoard.tsx";
import { LightField } from "../components/LightField.tsx";
import { RegCross } from "../components/RegCross.tsx";
import { WinOverlay } from "../components/WinOverlay.tsx";
import { DailyOverlay } from "../components/DailyOverlay.tsx";
import { useGame } from "../hooks/useGame.ts";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import type { SoundFx } from "../hooks/useSound.ts";
import { useSwipe } from "../hooks/useSwipe.ts";

const reduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Daily mode: the level of the day, played for the shared leaderboard rather
 *  than the campaign. Swaps the HUD banner and the win overlay. */
export interface DailyMode {
  date: string;
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
  onWin?: (moves: number, inputs: Input[]) => void;
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
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 font-mono text-paper select-none"
      style={{
        background:
          "radial-gradient(ellipse 68% 60% at 50% 46%, var(--color-box-glow), #1a1611 46%, var(--color-room) 80%)",
      }}
    >
      {/* the workshop around the table: a slow warm lamp, grain, and the sheet's
          registration crosses framing the four corners — the same lit room the
          title screen opens in, so the board reads as a print on the table
          rather than a widget in a void */}
      <LightField variant={0} reduced={reduced} />
      <div className="grain fixed inset-0" />
      <RegCross pos="top-10 left-10" />
      <RegCross pos="top-10 right-10" />
      <RegCross pos="bottom-10 left-10" />
      <RegCross pos="bottom-10 right-10" />

      <div className="relative z-10 flex flex-col items-center">
        <Hud
          plate={plate}
          total={total}
          level={level}
          moves={game.moves}
          muted={muted}
          onToggleMute={onToggleMute}
          onExit={onExit}
          daily={daily?.date}
          backLabel={daily ? m.daily_back() : undefined}
        />

        <Board
          level={level}
          st={game.st}
          solved={game.solved}
          bump={game.bump}
          bloom={game.bloom}
          iceTrailA={game.iceTrailA}
          iceTrailB={game.iceTrailB}
          {...swipe}
        >
          {game.solved &&
            (daily ? (
              <DailyOverlay
                date={daily.date}
                moves={game.moves}
                optimal={daily.optimal}
                inputs={game.wonInputs}
              />
            ) : (
              <WinOverlay
                plate={plate}
                moves={game.moves}
                best={best}
                onNext={onNext}
              />
            ))}
        </Board>

        <div className="mt-3.5 min-h-[30px] max-w-[400px] text-center text-[11.5px] tracking-[0.02em] text-paper/28">
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

        {!daily && (
          <LevelBoard
            levelId={level.id}
            solved={game.solved}
            moves={game.moves}
            wonTrace={game.wonTrace}
            className="mt-8 w-[min(92vw,420px)] xl:absolute xl:top-0 xl:left-full xl:mt-0 xl:ml-10 xl:w-[220px]"
          />
        )}
      </div>
    </div>
  );
}
