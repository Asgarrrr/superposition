// One-off backfill: recompute the `undos` column of every stored score row
// under the current correction rule (undos since the last reset — a reset is a
// fresh start, not a retouch; see submissionPolicy.undosOf). Rows written before
// that rule counted resets and pre-reset undos, so their `undos` — and thus the
// "sans retouche" seal and the (moves, undos) tie-break — are stale.
//
// `undos` for a VALID stored trace equals undosOf(trace): the server derived it
// via foldTrace, whose correction count is independent of the replayed state, and
// every stored trace already passed validateTrace. So this needs no level replay.
//
// Dry-run by default (prints what would change). Pass --apply to write.
//   bun scripts/backfill-undos.ts            # preview
//   bun scripts/backfill-undos.ts --apply    # commit the recount

import { eq } from "drizzle-orm";
import { db, pool } from "../src/db/index.ts";
import { dailyScore, levelScore } from "../src/db/schema.ts";
import { undosOf } from "../src/ui/submissionPolicy.ts";

const apply = process.argv.includes("--apply");

type ScoreTable = typeof dailyScore | typeof levelScore;

async function backfill(table: ScoreTable, label: string): Promise<void> {
  const rows = await db
    .select({ id: table.id, trace: table.trace, undos: table.undos })
    .from(table);

  let changed = 0;
  for (const row of rows) {
    const recomputed = undosOf(row.trace);
    if (recomputed === row.undos) continue;
    changed++;
    console.log(`  ${label}#${row.id}: undos ${row.undos} → ${recomputed}`);
    if (apply)
      await db
        .update(table)
        .set({ undos: recomputed })
        .where(eq(table.id, row.id));
  }
  console.log(
    `${label}: ${changed}/${rows.length} row(s) ${apply ? "updated" : "would change"}`,
  );
}

await backfill(dailyScore, "daily_score");
await backfill(levelScore, "level_score");
if (!apply) console.log("\ndry-run — re-run with --apply to write");
await pool.end();
