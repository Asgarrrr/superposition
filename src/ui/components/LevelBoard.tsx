// The per-level leaderboard rail, shown beside the board in campaign play. It
// reads the public board on mount, auto-submits the winning trace once the
// player has solved and is signed in (the server derives moves + corrections
// from it), and offers a sign-in gate (AuthPanel) to anyone who wants to post.
// Reading never needs an account.

import { useCallback, useEffect, useRef, useState } from "react";
import type { TraceStep } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { AuthPanel } from "./AuthPanel.tsx";
import { LeaderboardRows } from "./LeaderboardRows.tsx";
import { useSession } from "../../lib/auth-client.ts";
import { getLevelBoard, submitLevelScore } from "../../server/campaign.ts";
import type { LevelBoard as Board } from "../../server/campaign.ts";
import type { LeaderRow, MyResult } from "../../server/daily.ts";

type Phase = "idle" | "submitting" | "error";

export function LevelBoard({
  levelId,
  solved,
  moves,
  wonTrace,
  className = "",
}: {
  levelId: string;
  solved: boolean;
  moves: number; // the winning line's move count (for the resubmit guard)
  wonTrace: TraceStep[];
  className?: string;
}) {
  const { data: session, isPending } = useSession();
  const uid = session?.user.id;

  const [optimal, setOptimal] = useState(0);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [mine, setMine] = useState<MyResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [authOpen, setAuthOpen] = useState(false);
  // the best result we've already posted, per signed-in account: fewest moves,
  // then fewest corrections. An improved in-session solve re-posts, a worse or
  // equal one doesn't, and a fresh sign-in posts even at the same result.
  // Restored on failure so the next attempt retries.
  const submitted = useRef<{
    uid: string;
    moves: number;
    undos: number;
  } | null>(null);

  // close the sign-in gate as soon as a session lands
  useEffect(() => {
    if (uid) setAuthOpen(false);
  }, [uid]);

  // the latest winning result, readable from the submit effect WITHOUT being a
  // dependency — so submission fires on the solve edge, not on every move
  const latest = useRef({ moves, wonTrace });
  latest.current = { moves, wonTrace };
  const wasSolved = useRef(false);

  const applyBoard = useCallback((b: Board) => {
    setOptimal(b.optimal);
    setRows(b.rows);
    setMine(b.mine);
  }, []);

  // read the public board when the session resolves, the account changes, or
  // the level changes — never on a mid-solve move
  useEffect(() => {
    if (isPending) return;
    let alive = true;
    getLevelBoard({ data: { levelId } })
      .then((b) => alive && applyBoard(b))
      .catch(() => {
        /* best effort — leave what we have */
      });
    return () => {
      alive = false;
    };
  }, [isPending, uid, levelId, applyBoard]);

  // auto-submit on the solve EDGE only — never when an already-solved board
  // merely changes account (which would credit the new account with the prior
  // player's trace). Best result per account wins: fewer moves, then fewer
  // corrections; a worse re-solve doesn't repost. Refresh standings after.
  useEffect(() => {
    const justSolved = solved && !wasSolved.current;
    wasSolved.current = solved;
    if (isPending || !uid || !justSolved) return;

    const { moves: mv, wonTrace: trace } = latest.current;
    if (!trace.length) return;
    const undos = trace.filter(
      (s) => s.kind === "undo" || s.kind === "reset",
    ).length;
    const prev = submitted.current;
    const freshAccount = !prev || prev.uid !== uid;
    const improved =
      !!prev &&
      prev.uid === uid &&
      (mv < prev.moves || (mv === prev.moves && undos < prev.undos));
    if (!(freshAccount || improved)) return;

    let alive = true;
    submitted.current = { uid, moves: mv, undos };
    setPhase("submitting");
    void (async () => {
      try {
        await submitLevelScore({ data: { levelId, trace } });
        if (alive) setPhase("idle");
      } catch {
        submitted.current = prev; // restore so the next attempt retries
        if (alive) setPhase("error");
        return;
      }
      const b = await getLevelBoard({ data: { levelId } }).catch(() => null);
      if (alive && b) applyBoard(b);
    })();
    return () => {
      alive = false;
    };
  }, [isPending, uid, levelId, solved, applyBoard]);

  return (
    <aside className={`font-mono ${className}`}>
      <div className="mb-2 flex items-baseline justify-between border-b border-paper/10 pb-2">
        <span className="text-[10px] tracking-[0.28em] text-paper/40 uppercase">
          {m.level_leaderboard_title()}
        </span>
        {optimal > 0 && (
          <span className="text-[10px] tracking-[0.12em] text-paper/30">
            {m.daily_optimal({ optimal })}
          </span>
        )}
      </div>

      <LeaderboardRows
        rows={rows}
        uid={uid}
        limit={12}
        emptyLabel={m.level_leaderboard_empty()}
      />

      {/* footer: your standing when signed in, otherwise a sign-in gate */}
      <div className="mt-3 border-t border-paper/10 pt-2 text-[11px] tracking-[0.1em]">
        {phase === "submitting" && (
          <span className="text-paper/50">{m.daily_submitting()}</span>
        )}
        {phase === "error" && (
          <span className="text-ink-magenta">{m.daily_submit_error()}</span>
        )}
        {phase === "idle" &&
          (uid ? (
            mine && (
              <span className="text-paper/60">
                {m.daily_your_rank({ rank: mine.rank })} · {mine.moves}
              </span>
            )
          ) : (
            <button
              type="button"
              className="btn border-none p-0 text-[11px] text-paper/40 transition-colors hover:text-paper/70"
              onClick={() => setAuthOpen(true)}
            >
              {m.level_signin_cta()} →
            </button>
          ))}
      </div>

      {authOpen && !uid && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-room/85 px-4 backdrop-blur-xs"
          onClick={() => setAuthOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AuthPanel />
          </div>
        </div>
      )}
    </aside>
  );
}
