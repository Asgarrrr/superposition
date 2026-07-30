ALTER TABLE "daily_puzzle" ADD COLUMN "generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill. The cron writes today plus a J+1/J+2 buffer, and `ensureTier` skips
-- any (date, tier) that already has a row — so without this, the puzzles already
-- in the table at deploy time would keep `generated = false` forever, and the
-- first days after the release would silently record no time at all.
-- A future-dated row is provably cron-written: the only other writer is a score
-- submission, and `isSubmittableDay` accepts today or yesterday alone, so no
-- submission can pin a row dated after today. Today's own rows stay false — they
-- could be either writer, and under-claiming costs one day of clocking whereas
-- over-claiming would clock a grid the client can recompute offline.
UPDATE "daily_puzzle" SET "generated" = true
  WHERE "date" > to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
