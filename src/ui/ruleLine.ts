// The rule line under the light box: one tip at a time,
// chosen by the level's most defining mechanic.

import type { GameState, Level } from "../engine/types.ts";
import { eq } from "../engine/grid.ts";
import { m } from "../paraglide/messages.js";
import { altGesture } from "./altGesture.ts";
import { altHint } from "./gestureHint.ts";

export function ruleLine(st: GameState, level: Level): string {
  // the world tip leads exactly while the world gesture is on offer
  if (altGesture(st, level) === "shift")
    return eq(st.off, [0, 0])
      ? m.rule_decalage_aligned({ alt: altHint() })
      : m.rule_decalage_off({ x: st.off[0], y: st.off[1] });
  if (level.mods.includes("glace")) return m.rule_glace();
  if ((level.lightWalls ?? []).length) return m.rule_lightwalls();
  if (level.mods.includes("fusion"))
    return st.merged
      ? m.rule_fusion_merged({ alt: altHint() })
      : m.rule_fusion_split();
  return m.rule_base();
}
