// The leaderboard submission policy, as a pure decision function. React feeds
// events in (LeaderboardRail) and executes the decisions; everything that must
// hold across sessions and network failures is encoded here, testable without
// a mount:
//   · one post per solve — a solve event is the only thing that re-arms it;
//   · a solve posted (or declined) under account A never auto-posts under B —
//     switching or re-authenticating can't launder the prior player's trace;
//   · a solve made while signed out is claimed by the first account to sign
//     in, provided nothing was posted before it;
//   · per account the best result wins: fewer moves, then fewer corrections —
//     an improved re-solve posts again, a worse or equal one doesn't;
//   · a failed post leaves the solve submittable: retry (or a session change)
//     posts it again.
// The client's moves/undos here are advisory, used only to decide WHETHER to
// post — the server re-derives both from the raw trace (see server/replay.ts).

import type { TraceStep } from "../engine/types.ts";

/** The domain value of a win: the full raw trace (corrections included, for
 *  server-side replay) and the winning line's move count, computed once at the
 *  solve edge by useGame. */
export interface Solve {
  readonly trace: TraceStep[];
  readonly moves: number;
}

interface Result {
  readonly moves: number;
  readonly undos: number;
}

export interface SubmissionState {
  readonly uid: string | null;
  /** The best result already posted, tagged with the account that posted it.
   *  Survives sign-out — this is the anti-laundering ledger. */
  readonly posted: (Result & { readonly uid: string }) | null;
  /** The current solve not yet posted: awaiting an account, a retry, or the
   *  end of an in-flight post. Cleared once posted, declined, or undone. */
  readonly pending: (Result & { readonly trace: TraceStep[] }) | null;
  /** The payload of the post currently on the wire, so a success knows what
   *  to record and a concurrent event can't double-post. */
  readonly inFlight:
    | (Result & {
        readonly uid: string;
        readonly trace: TraceStep[];
      })
    | null;
}

export const initialSubmission: SubmissionState = {
  uid: null,
  posted: null,
  pending: null,
  inFlight: null,
};

export type SubmissionEvent =
  | { kind: "solve"; solve: Solve | null } // win edge, or the win undone (null)
  | { kind: "session"; uid: string | null } // session resolved / account change
  | { kind: "retry" } // the player asked to retry a failed post
  | { kind: "submitted" } // the in-flight post succeeded
  | { kind: "failed" }; // the in-flight post failed

export interface SubmissionDecision {
  readonly state: SubmissionState;
  /** When set, post this trace now, then feed back `submitted` or `failed`. */
  readonly submit: TraceStep[] | null;
}

const undosOf = (trace: TraceStep[]) =>
  trace.filter((s) => s.kind === "undo" || s.kind === "reset").length;

const stay = (state: SubmissionState): SubmissionDecision => ({
  state,
  submit: null,
});

/** Evaluates the pending solve against the account and the posted ledger. */
function settle(state: SubmissionState): SubmissionDecision {
  const { uid, posted, pending, inFlight } = state;
  if (!pending || inFlight || !uid) return stay(state);
  const freshAccount = !posted || posted.uid !== uid;
  const improved =
    !!posted &&
    posted.uid === uid &&
    (pending.moves < posted.moves ||
      (pending.moves === posted.moves && pending.undos < posted.undos));
  if (!freshAccount && !improved)
    // evaluated and declined: the solve is spent, so it can't linger and be
    // claimed later under a different account
    return stay({ ...state, pending: null });
  return {
    state: { ...state, inFlight: { uid, ...pending } },
    submit: pending.trace,
  };
}

export function decideSubmission(
  state: SubmissionState,
  event: SubmissionEvent,
): SubmissionDecision {
  switch (event.kind) {
    case "solve": {
      // an undone win takes its unposted solve with it (a post already on the
      // wire stands — the server has it either way)
      if (!event.solve) return stay({ ...state, pending: null });
      const { trace, moves } = event.solve;
      return settle({
        ...state,
        pending: { trace, moves, undos: undosOf(trace) },
      });
    }
    case "session":
      return settle({ ...state, uid: event.uid });
    case "retry":
      return settle(state);
    case "submitted": {
      const f = state.inFlight;
      if (!f) return stay(state);
      return settle({
        ...state,
        posted: { uid: f.uid, moves: f.moves, undos: f.undos },
        inFlight: null,
        // a NEWER solve may have landed while this one was on the wire — keep
        // it for evaluation; the one just posted is done
        pending: state.pending?.trace === f.trace ? null : state.pending,
      });
    }
    case "failed":
      // nothing recorded as posted, so the pending solve stays submittable
      return stay({ ...state, inFlight: null });
  }
}
