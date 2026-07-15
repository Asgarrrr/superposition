// The editorial block: the level's title and its one-line hint. Navigation,
// level progress, sound and the move count now live in the left rail (LeftRail);
// this stays purely editorial so the title reads as the sheet's caption. Its
// bottom rule is the shared baseline the two rails align their headers onto.

import type { Level } from "../../engine/types.ts";
import { m } from "../../paraglide/messages.js";
import { levelHint } from "../copy.ts";

export function Hud({
  level,
  daily,
}: {
  level: Level;
  daily?: boolean; // daily mode: swap the title for the daily tag
}) {
  return (
    <div className="mb-4 flex w-[min(92vw,520px)] flex-col gap-1 border-b border-paper/10 pb-3 xl:mb-0">
      <div className="font-display text-[26px] leading-none italic tracking-[0.02em]">
        {daily ? m.daily_tag() : level.name}
      </div>
      <div className="mt-0.5 font-display text-base not-italic tracking-[0.01em] text-paper/45">
        {levelHint(level.id)}
      </div>
    </div>
  );
}
