// Daily puzzle generator — the cron service's entry point (`bun run gen:daily`).
// Hunts three certified levels of rising difficulty (one per tier) for today
// plus a J+1/J+2 buffer (so a missed cron run doesn't leave a gap), writes each
// to daily_puzzle, then closes the pool and exits. Railway runs this on
// `0 5 * * *` (UTC); it MUST exit or the next run is skipped.

import { and, eq } from "drizzle-orm";
import { db, pool } from "../db/index.ts";
import { dailyPuzzle } from "../db/schema.ts";
import { isWeekend, utcDay } from "../lib/day.ts";
import { hunt } from "./hunt.ts";
import { levelSignature } from "./signature.ts";
import type { Level, MechanicId } from "../engine/types.ts";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};

// The three tiers, difficulty rising with the solution length and — at the top
// tier — an extra mechanic. `minLen` is the floor; we keep the SHORTEST find ≥
// it, so each day lands near its band (easy ~8-10, medium ~16, hard ~22+) rather
// than a monster. Ordered floors keep the three strictly monotone. This object
// is the single tuning point: swap `glace` for `decalage` to make the hard tier
// prove an extra mechanic mandatory (rarer to generate, so give it more budget).
const msOverride = arg("ms", "");
const TIERS: {
  tier: number;
  label: string;
  mods: MechanicId[];
  size: number;
  minLen: number;
  budgetMs: number;
}[] = [
  { tier: 0, label: "facile", mods: ["fusion", "scission"], size: 5, minLen: 8, budgetMs: 4000 }, // prettier-ignore
  { tier: 1, label: "moyen", mods: ["fusion", "scission"], size: 5, minLen: 16, budgetMs: 5000 }, // prettier-ignore
  { tier: 2, label: "difficile", mods: ["fusion", "scission", "glace"], size: 5, minLen: 22, budgetMs: 9000 }, // prettier-ignore
  // tier 3 — the weekend "épreuve d'artiste": a 6×6 board (a whole extra rank of
  // branching over the 5×5 tiers) with every ink in play, a long floor, and a
  // fat budget since the bigger board is rarer to certify. Generated for weekend
  // dates only (gated in the loop below); no bank fallback exists for it.
  { tier: 3, label: "épreuve d'artiste", mods: ["fusion", "scission", "glace"], size: 6, minLen: 26, budgetMs: 45000 }, // prettier-ignore
];
const WEEKEND_TIER = 3;
const DAYS = Number(arg("days", "3")); // today + buffer

// Every puzzle ever issued, by signature — so we never reissue one, nor a mere
// mirror/rotation of it. Seeded from the DB, then grown with each pick below so
// the buffer days (J+1/J+2) don't repeat what today just took either.
const usedSigs = new Set<string>();

async function loadHistory(): Promise<void> {
  const rows = await db.select({ level: dailyPuzzle.level }).from(dailyPuzzle);
  for (const r of rows) usedSigs.add(levelSignature(r.level));
  console.log(
    `· ${usedSigs.size} past puzzle(s) loaded — will not repeat them`,
  );
}

async function ensureTier(
  date: string,
  cfg: (typeof TIERS)[number],
): Promise<void> {
  const [existing] = await db
    .select()
    .from(dailyPuzzle)
    .where(and(eq(dailyPuzzle.date, date), eq(dailyPuzzle.tier, cfg.tier)))
    .limit(1);
  if (existing) {
    console.log(`· ${date} T${cfg.tier} already present — skipping`);
    return;
  }

  // a global --ms speed-up must not starve the weekend 6×6 (its hunt is tuned to
  // need far more than the campaign tiers); it keeps its configured budget
  const budgetMs =
    msOverride && cfg.tier !== WEEKEND_TIER ? Number(msOverride) : cfg.budgetMs;
  // reject anything already used; stop early once we hit the tier's floor length
  // (can't beat it) instead of exhausting the budget
  const { found, tested } = hunt({
    mods: cfg.mods,
    size: cfg.size,
    minLen: cfg.minLen,
    budgetMs,
    seen: usedSigs,
    stopAtLen: cfg.minLen,
  });
  if (!found.length) {
    // the weekend tier has NO bank fallback: a miss means no épreuve that
    // weekend. Campaign tiers 0–2 are covered by the deterministic web fallback.
    const note =
      cfg.tier === WEEKEND_TIER
        ? "no épreuve this weekend (this tier has no fallback)"
        : "the web fallback will cover this tier";
    console.warn(
      `! ${date} T${cfg.tier} (${cfg.label}) — no new certified level in ${budgetMs}ms (tested ${tested}); ${note}`,
    );
    return;
  }
  // shortest solution ≥ minLen → a consistent puzzle in the tier's band
  const pick = found.reduce((a, b) => (b.len < a.len ? b : a));
  usedSigs.add(pick.sig); // never hand this one out again, this run or later
  const level: Level = {
    ...pick.lv,
    id: `daily-${date}-t${cfg.tier}`,
    name: `Édition ${date} · ${cfg.label}`,
    ch: "JOUR",
  };

  await db
    .insert(dailyPuzzle)
    .values({ date, tier: cfg.tier, level, optimal: pick.len });
  console.log(
    `✓ ${date} T${cfg.tier} (${cfg.label}) · ${pick.len} coups · ${pick.proofs.join(", ")}`,
  );
}

try {
  await loadHistory();
  for (let off = 0; off < DAYS; off++) {
    const date = utcDay(off);
    for (const cfg of TIERS) {
      // the weekend tier only exists Sat/Sun; skip it on weekdays
      if (cfg.tier === WEEKEND_TIER && !isWeekend(date)) continue;
      await ensureTier(date, cfg);
    }
  }
} catch (err) {
  console.error(err);
  await pool.end();
  process.exit(1);
}

await pool.end();
process.exit(0);
