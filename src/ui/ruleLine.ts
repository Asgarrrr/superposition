// The rule line under the light box: one tip at a time,
// chosen by the level's most defining mechanic.

import type { GameState, Level } from "../engine/types.ts";
import { eq } from "../engine/grid.ts";
import { m } from "../paraglide/messages.js";
import { altGesture } from "./altGesture.ts";
import { altHint } from "./gestureHint.ts";

export function ruleLine(st: GameState, level: Level): string {
  // the world tip leads exactly while the world gesture is on offer. On a repere
  // level, once the marks are off, point at the pins that snap them home — the
  // one variant that mentions them (still a single tip, still shift-led).
  if (altGesture(st, level) === "shift")
    return eq(st.off, [0, 0])
      ? m.rule_decalage_aligned({ alt: altHint() })
      : (level.pins ?? []).length
        ? m.rule_repere_off({ x: st.off[0], y: st.off[1] })
        : m.rule_decalage_off({ x: st.off[0], y: st.off[1] });
  // verso: the mirror is the chapter's new rule, so it leads over ice/fusion —
  // but only while unmerged, since the fused pawn lives on the glass and follows
  // the raw direction (the film's mirror no longer applies).
  if (!st.merged && level.mods.includes("verso")) return m.rule_verso();
  if (level.mods.includes("glace")) return m.rule_glace();
  if ((level.lightWalls ?? []).length) return m.rule_lightwalls();
  if (level.mods.includes("fusion"))
    return st.merged
      ? m.rule_fusion_merged({ alt: altHint() })
      : m.rule_fusion_split();
  return m.rule_base();
}
