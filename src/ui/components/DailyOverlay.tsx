// Win overlay for the daily level: the "ready to print" veil, then the result,
// an account gate (AuthPanel), auto-submission of the winning inputs, and the
// day's leaderboard.

import { useEffect, useRef, useState } from "react";
import type { Input } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { Wordmark } from "./Wordmark.tsx";
import { AuthPanel } from "./AuthPanel.tsx";
import { LeaderboardRows } from "./LeaderboardRows.tsx";
import { signOut, useSession } from "../../lib/auth-client.ts";
import {
  getDailyLeaderboard,
  getMyDailyResult,
  submitDailyScore,
} from "../../server/daily.ts";
import type { LeaderRow, MyResult } from "../../server/daily.ts";

type Phase = "idle" | "submitting" | "done" | "error";

export function DailyOverlay({
  date,
  moves,
  optimal,
  inputs,
}: {
  date: string;
  moves: number;
  optimal: number;
  inputs: Input[];
}) {
  const { data: session, isPending } = useSession();
  const uid = session?.user.id;

  const [phase, setPhase] = useState<Phase>("idle");
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [mine, setMine] = useState<MyResult | null>(null);
  // the account we've submitted for; keyed by uid so a different account signed
  // in within the same overlay still submits, and reset on failure to retry
  const submittedFor = useRef<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    let alive = true;

    const refresh = async () => {
      // the board and the caller's own result are independent GETs — run them
      // together instead of waiting for the board before asking for mine
      const [rows, r] = await Promise.all([
        getDailyLeaderboard(),
        uid ? getMyDailyResult() : Promise.resolve(null),
      ]);
      if (!alive) return;
      setBoard(rows);
      if (uid) setMine(r);
    };

    const run = async () => {
      if (uid && inputs.length && submittedFor.current !== uid) {
        submittedFor.current = uid;
        setPhase("submitting");
        try {
          await submitDailyScore({ data: { inputs, date } });
          if (alive) setPhase("done");
        } catch {
          submittedFor.current = null; // allow a retry
          if (alive) setPhase("error");
        }
      }
      await refresh();
    };

    run().catch(() => {
      /* leaderboard/session fetch failed — best effort, leave the board empty */
    });
    return () => {
      alive = false;
    };
  }, [isPending, uid, inputs, date]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-room/85 px-4 py-6 backdrop-blur-xs">
      <div className="scale-72">
        <Wordmark aligned size={36} />
      </div>
      <div
        className="rounded-sm border-[2.5px] border-tape px-4.5 py-2 font-mono text-[13px] tracking-[0.28em] text-tape uppercase"
        style={{
          animation: "sp-stamp 700ms cubic-bezier(0.2,1.4,0.4,1) 550ms both",
        }}
      >
        {m.win_stamp()}
      </div>
      <div className="font-mono text-[11px] tracking-[0.15em] text-paper/50">
        {m.daily_solved({ count: moves })}
        {optimal ? ` · ${m.daily_optimal({ optimal })}` : ""}
      </div>

      {!isPending && !uid && <AuthPanel />}

      {uid && (
        <div className="flex flex-col items-center gap-1">
          <div className="font-mono text-[11px] tracking-[0.12em] text-paper/60">
            {phase === "submitting" && m.daily_submitting()}
            {phase === "done" &&
              (mine
                ? m.daily_your_rank({ rank: mine.rank })
                : m.daily_submitted())}
            {phase === "error" && (
              <span className="text-ink-magenta">{m.daily_submit_error()}</span>
            )}
          </div>
          <button
            type="button"
            className="btn border-none p-0 text-[10px] text-paper/30"
            onClick={() => {
              void signOut().catch(() => {});
            }}
          >
            {m.daily_signout()}
          </button>
        </div>
      )}

      <Leaderboard rows={board} uid={uid} />
    </div>
  );
}

function Leaderboard({ rows, uid }: { rows: LeaderRow[]; uid?: string }) {
  return (
    <div className="w-[min(88vw,300px)]">
      <div className="mb-1 text-center text-[10px] tracking-[0.28em] text-paper/40 uppercase">
        {m.daily_leaderboard_title()}
      </div>
      <LeaderboardRows
        rows={rows}
        uid={uid}
        emptyLabel={m.daily_leaderboard_empty()}
        listClassName="max-h-[34vh] overflow-y-auto"
      />
    </div>
  );
}
