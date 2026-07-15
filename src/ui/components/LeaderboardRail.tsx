// The leaderboard rail shown beside the board during play. One rail, two callers:
// the campaign (LevelBoard) and the daily (DailyBoard) differ only in where the
// board is read from, where a score is posted, and its labels — passed in as a
// `source`. The rail owns the shared logic: read the public board on mount,
// auto-submit the winning trace on the solve edge (the server derives moves +
// corrections from it), a sign-in gate (AuthPanel), and the standing footer.
// Reading never needs an account.

import { useEffect, useRef, useState } from "react";
import type { TraceStep } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { AuthPanel } from "./AuthPanel.tsx";
import { LeaderboardRows } from "./LeaderboardRows.tsx";
import { useSession } from "../../lib/auth-client.ts";
import type { BoardData, LeaderRow, MyResult } from "../../server/daily.ts";

/** What differs between the campaign and daily rails. `read`/`submit` MUST be
 *  referentially stable per their own inputs (wrap in useCallback) — the rail
 *  keys its read effect on them. */
export interface BoardSource {
  read: () => Promise<BoardData>;
  submit: (trace: TraceStep[]) => Promise<void>;
  title: string;
  emptyLabel: string;
}

type Phase = "idle" | "submitting" | "error";

export function LeaderboardRail({
  source,
  solved,
  moves,
  wonTrace,
  className = "",
}: {
  source: BoardSource;
  solved: boolean;
  moves: number; // the winning line's move count (for the resubmit guard)
  wonTrace: TraceStep[];
  className?: string;
}) {
  const { read, submit, title, emptyLabel } = source;
  const { data: session, isPending } = useSession();
  const uid = session?.user.id;

  const [optimal, setOptimal] = useState(0);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [mine, setMine] = useState<MyResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [authOpen, setAuthOpen] = useState(false);
  // bumped by the error footer to re-fire the submit effect: a failed post has
  // no other trigger (its deps don't change when the network recovers), so
  // without this a transient failure would strand the score until a remount.
  const [retry, setRetry] = useState(0);
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

  const apply = (b: BoardData) => {
    setOptimal(b.optimal);
    setRows(b.rows);
    setMine(b.mine);
  };

  // read the public board when the session resolves, the account changes, or
  // the source changes — never on a mid-solve move
  useEffect(() => {
    if (isPending) return;
    let alive = true;
    read()
      .then((b) => alive && apply(b))
      .catch(() => {
        /* best effort — leave what we have */
      });
    return () => {
      alive = false;
    };
  }, [isPending, uid, read]);

  // submit when this session's player just solved, or when a signed-in account
  // first claims a solve that nobody has posted yet — a player who solved signed
  // out and then signed in, or whose session only just resolved after the win.
  // A solve already posted (`submitted` is set and survives a sign-out) is never
  // re-posted under a different account, so switching or re-authenticating can't
  // launder the prior player's trace. Best result per account wins: fewer moves,
  // then fewer corrections; a worse re-solve doesn't repost. Refresh after.
  useEffect(() => {
    const justSolved = solved && !wasSolved.current;
    wasSolved.current = solved;
    if (isPending || !uid) return;
    if (!justSolved && !(solved && !submitted.current)) return;

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
        await submit(trace);
        if (alive) setPhase("idle");
      } catch {
        submitted.current = prev; // restore so the next attempt retries
        if (alive) setPhase("error");
        return;
      }
      const b = await read().catch(() => null);
      if (alive && b) apply(b);
    })();
    return () => {
      alive = false;
    };
  }, [isPending, uid, solved, read, submit, retry]);

  return (
    <aside className={`font-mono ${className}`}>
      <div className="mb-2 flex items-baseline justify-between border-b border-paper/10 pb-2">
        <span className="text-[10px] tracking-[0.28em] text-paper/40 uppercase">
          {title}
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
        emptyLabel={emptyLabel}
      />

      {/* footer: your standing when signed in, otherwise a sign-in gate */}
      <div className="mt-3 border-t border-paper/10 pt-2 text-[11px] tracking-[0.1em]">
        {phase === "submitting" && (
          <span className="text-paper/50">{m.daily_submitting()}</span>
        )}
        {phase === "error" && (
          <button
            type="button"
            className="btn border-none p-0 text-[11px] text-ink-magenta transition-opacity hover:opacity-70"
            onClick={() => setRetry((r) => r + 1)}
          >
            {m.daily_submit_error()}
          </button>
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
