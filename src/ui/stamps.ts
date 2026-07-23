// The three campaign stamps, derived purely from what's persisted (best score
// + the clean ledger, see useBestScores) and the solver-certified par. "Tiré"
// — solved, on the record — is just the presence of a best and is read inline
// in the selector; here we derive the two that need par or the clean flag:
//   · bon à tirer — the record equals the solver's optimum (best ≤ par);
//   · sans retouche — cleared at least once with no correction (the sticky
//     clean flag).
// A pure function of stored data, so the selector and the win overlay can read
// the same truth. Unknown ids (no par) are safe: they simply can't be at par.

import { PAR } from "../engine/par.ts";

export interface Stamps {
  /** bon à tirer — the record matches the solver's optimum */
  readonly bat: boolean;
  /** sans retouche — cleared once with no undo/reset */
  readonly sans: boolean;
}

export function stamps(
  id: string,
  best: number | undefined,
  clean: Record<string, true>,
): Stamps {
  const par = PAR[id];
  return {
    bat: best !== undefined && par !== undefined && best <= par,
    sans: !!clean[id],
  };
}
