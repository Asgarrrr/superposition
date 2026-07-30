ALTER TABLE "daily_score" ALTER COLUMN "elapsed_ms" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "daily_score" ALTER COLUMN "elapsed_ms" DROP NOT NULL;--> statement-breakpoint
-- Hand-written data step. 0007 added the column NOT NULL DEFAULT 1800000 — the
-- 30-minute ceiling an earlier design used as its "we could not measure this"
-- sentinel — and backfilled every existing row to it. The ceiling is gone: null
-- now carries that meaning, and orders NULLS LAST so an unmeasured result sits
-- behind every measured one. Left as they are, those rows would assert a
-- 30-minute measurement nobody ever took, and would sort AHEAD of honestly-null
-- ones. Safe because 0007 has never been deployed: the only rows carrying this
-- exact value are its own backfill and the capped writes from the same
-- short-lived branch, and neither is a real measurement.
UPDATE "daily_score" SET "elapsed_ms" = NULL WHERE "elapsed_ms" = 1800000;
