// The Wordle-style share block for a solved daily tier: a header, the move
// count against the optimal, an emoji plate that evokes the two-ink board, then
// the game URL. The engine is deterministic and the optimal travels with the
// puzzle, so this is pure text assembly — no solving here.

import type { Level } from "../engine/types.ts";
import { eq, wallSet } from "../engine/grid.ts";
import { m } from "../paraglide/messages.js";

// palier labels are 1-based roman numerals (tier 0 → palier I); the weekend
// épreuve (tier 3) reads as IV.
const ROMAN = ["I", "II", "III", "IV"] as const;

// The plate: the two ink targets on the dark box, walls as the masked field.
// Cyan and magenta goal squares are the essence; when they coincide the pawns
// fuse to white. A few emoji rows — one per board line.
export function shareGrid(level: Level): string {
  const n = level.size;
  const walls = wallSet(
    [...level.a.walls, ...level.b.walls, ...(level.lightWalls ?? [])],
    n,
  );
  const cyan = level.a.goal;
  const magenta = level.b.goal;
  const fused = eq(cyan, magenta);

  const rows: string[] = [];
  for (let r = 0; r < n; r++) {
    let row = "";
    for (let c = 0; c < n; c++) {
      if (fused && eq([r, c], cyan)) row += "⬜";
      else if (eq([r, c], cyan)) row += "🟦";
      else if (eq([r, c], magenta)) row += "🟪";
      else if (walls.has(r * n + c)) row += "🟫";
      else row += "⬛";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

/** The full share block. `optimal` of 0 means "unknown" (never resolved) and
 *  the optimal clause is dropped. */
export function buildDailyShare({
  level,
  date,
  tier,
  moves,
  optimal,
  url,
}: {
  level: Level;
  date: string;
  tier: number;
  moves: number;
  optimal: number;
  url: string;
}): string {
  const header = m.daily_share_header({
    date,
    tier: ROMAN[tier] ?? String(tier + 1),
  });
  const movesLine = optimal
    ? m.daily_share_moves({ count: moves, optimal })
    : m.daily_share_moves_solo({ count: moves });
  return `${header}\n${movesLine}\n${shareGrid(level)}\n${url}`;
}

/** Copy to the clipboard, falling back to a hidden textarea + execCommand where
 *  the async Clipboard API is unavailable or blocked. Returns whether the copy
 *  actually landed — a swallowed failure would flash a false "Copié". */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path (e.g. permission or insecure context)
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    // execCommand returns false when the copy is refused; honour it
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

/** Share via the native sheet when present (mobile), else copy. Returns which
 *  path ran so the caller only flashes "copied" on a real copy — "failed" when
 *  the clipboard refused, so the UI stays sober rather than lying. */
export async function shareOrCopy(
  text: string,
): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      // user dismissed the sheet: honour that, don't silently copy behind it
      if (err instanceof Error && err.name === "AbortError") return "shared";
      // any other failure (no permission, unsupported payload): fall to copy
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}
