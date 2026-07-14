// Daily puzzle generator — the cron service's entry point (`bun run gen:daily`).
// Hunts a certified level for today plus a J+1/J+2 buffer (so a missed cron run
// doesn't leave a gap), writes each to daily_puzzle, then closes the pool and
// exits. Railway runs this on `0 5 * * *` (UTC); it MUST exit or the next run
// is skipped.

import { eq } from "drizzle-orm";
import { db, pool } from "../db/index.ts";
import { dailyPuzzle } from "../db/schema.ts";
import { utcDay } from "../lib/day.ts";
import { hunt } from "./hunt.ts";
import type { Level, MechanicId } from "../engine/types.ts";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};

// v1 difficulty: fusion+scission proven necessary, ~16 moves. Difficulty
// variation (by weekday, extra mechanics) is a future improvement.
const CONFIG = {
  mods: ["fusion", "scission"] as MechanicId[],
  size: 5,
  minLen: 16,
  budgetMs: Number(arg("ms", "6000")),
};
const DAYS = Number(arg("days", "3")); // today + buffer

async function ensureDaily(date: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(dailyPuzzle)
    .where(eq(dailyPuzzle.date, date))
    .limit(1);
  if (existing) {
    console.log(`· ${date} already present — skipping`);
    return;
  }

  const { found, tested } = hunt(CONFIG);
  if (!found.length) {
    console.warn(
      `! ${date} — no certified level found in ${CONFIG.budgetMs}ms (tested ${tested}); the web fallback will cover this day`,
    );
    return;
  }
  // shortest solution ≥ minLen → a consistent, ~16-move daily rather than a monster
  const pick = found.reduce((a, b) => (b.len < a.len ? b : a));
  const level: Level = {
    ...pick.lv,
    id: `daily-${date}`,
    name: `Édition ${date}`,
    ch: "JOUR",
  };

  await db.insert(dailyPuzzle).values({ date, level, optimal: pick.len });
  console.log(`✓ ${date} · ${pick.len} coups · ${pick.proofs.join(", ")}`);
}

try {
  for (let off = 0; off < DAYS; off++) await ensureDaily(utcDay(off));
} catch (err) {
  console.error(err);
  await pool.end();
  process.exit(1);
}

await pool.end();
process.exit(0);
