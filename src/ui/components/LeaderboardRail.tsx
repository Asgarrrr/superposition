// The leaderboard rail shown beside the board during play. One rail, two callers:
// the campaign (LevelBoard) and the daily (DailyBoard) differ only in where the
// board is read from, where a score is posted, and its labels — passed in as a
// `source`. The rail owns the shared React wiring: read the public board on
// mount, a sign-in gate (AuthPanel), and the standing footer. WHETHER a solve
// is posted — once per solve, best result per account, no trace laundering
// across accounts — is decided by the pure policy in submissionPolicy.ts; the
// rail only feeds it events and executes its decisions (the server derives
// moves + corrections from the raw trace). Reading never needs an account.

import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "motion/react";
import type { TraceStep } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { AuthPanel } from "./AuthPanel.tsx";
import { LeaderboardRows } from "./LeaderboardRows.tsx";
import { useSession } from "../../lib/auth-client.ts";
import {
  decideSubmission,
  initialSubmission,
  type Solve,
  type SubmissionEvent,
} from "../submissionPolicy.ts";
import type {
  BoardData,
  LeaderRow,
  MyResult,
} from "../../server/leaderboard.ts";

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
  solve,
  className = "",
  variants,
}: {
  source: BoardSource;
  solve: Solve | null; // the win, once it happens (a fresh object per solve)
  className?: string;
  variants?: Variants; // develop-in: inherits the parent's hidden→visible label
}) {
  const { read, submit, title, emptyLabel } = source;
  const { data: session, isPending } = useSession();
  const uid = session?.user.id;

  const [optimal, setOptimal] = useState(0);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [mine, setMine] = useState<MyResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [authOpen, setAuthOpen] = useState(false);
  // the policy's memory (what was posted, by whom) — a ref, not state: it must
  // survive sign-outs unchanged and never itself cause a render
  const policy = useRef(initialSubmission);

  // close the sign-in gate as soon as a session lands
  useEffect(() => {
    if (uid) setAuthOpen(false);
  }, [uid]);

  const apply = (b: BoardData) => {
    setOptimal(b.optimal);
    setRows(b.rows);
    setMine(b.mine);
  };

  // feed one event to the policy and execute its decision; success/failure
  // loop back in as events so the policy sees the whole submission lifecycle
  const dispatch = (event: SubmissionEvent) => {
    const { state, submit: payload } = decideSubmission(policy.current, event);
    policy.current = state;
    if (!payload) return;
    setPhase("submitting");
    void (async () => {
      try {
        await submit(payload);
      } catch {
        dispatch({ kind: "failed" });
        setPhase("error");
        return;
      }
      dispatch({ kind: "submitted" });
      setPhase("idle");
      const b = await read().catch(() => null);
      if (b) apply(b);
    })();
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

  // policy events: the solve edge (each win is a new object; null = undone) …
  useEffect(() => {
    dispatch({ kind: "solve", solve });
    // dispatch is recreated per render but only closes over stable refs/setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solve]);

  // … and the session resolving or changing accounts
  useEffect(() => {
    if (isPending) return;
    dispatch({ kind: "session", uid: uid ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, uid]);

  return (
    <motion.aside
      className={`flex flex-col font-mono ${className}`}
      variants={variants}
    >
      {/* header — its own subgrid row on xl (shares the Hud's row), stretched so
          its baseline rule lands on the Hud's rule; content bottom-aligned so the
          short title sits just above that shared line rather than floating up. */}
      <div className="mb-2 flex items-baseline justify-between border-b border-paper/10 pb-2 xl:mb-0 xl:items-end">
        <span className="text-[10px] tracking-[0.28em] text-paper/40 uppercase">
          {title}
        </span>
        {optimal > 0 && (
          <span className="text-[10px] tracking-[0.12em] text-paper/30">
            {m.daily_optimal({ optimal })}
          </span>
        )}
      </div>

      {/* body — the board's row on xl: rows at the top, standing pinned to the
          bottom so its edge meets the board's lower edge. */}
      <div className="flex flex-col xl:min-h-0 xl:pt-4">
        <LeaderboardRows
          rows={rows}
          uid={uid}
          limit={12}
          emptyLabel={emptyLabel}
        />

        <div className="mt-3 border-t border-paper/10 pt-2 text-[11px] tracking-[0.1em] xl:mt-auto">
          {phase === "submitting" && (
            <span className="text-paper/50">{m.daily_submitting()}</span>
          )}
          {phase === "error" && (
            <button
              type="button"
              className="btn border-none p-0 text-[11px] text-ink-magenta transition-opacity hover:opacity-70"
              onClick={() => dispatch({ kind: "retry" })}
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
    </motion.aside>
  );
}
