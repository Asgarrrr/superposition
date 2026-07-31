// The hors-série: stamps that are NOT part of the current series.
//
// The four families of `distinctions.ts` are the série courante — always four,
// bounded by construction, and every profile shows all four (earned, or as an
// empty album mount). A commemorative is the opposite on every count: it has no
// tiers, no threshold and no face value to climb; you either hold it or you do
// not; and a profile that does not hold one shows NOTHING, because a stamp that
// was never put on sale cannot be missing from an album.
//
// That asymmetry is why this is its own module rather than a fifth family:
// issuing one here can never widen the series row, so the page's layout stays
// fixed however many commemoratives get struck.
//
// Nothing grants `sissi` yet. The easter egg that hands it over is not designed,
// so the stamp is issued but unobtainable and every profile carries an empty
// list. When the trigger exists it only has to fill that list — the artwork, the
// layout and the profile plumbing are already in place.

export type Commemorative = "sissi";

/** A commemorative a player holds, with the day it was struck — the postmark.
 *  Mirrors what a series stamp carries, so `Stamp` can render either. */
export interface Held {
  readonly key: Commemorative;
  /** YYYY-MM-DD (UTC). */
  readonly earnedOn: string;
}
