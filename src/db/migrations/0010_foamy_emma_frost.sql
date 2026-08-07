ALTER TABLE "level_score" ADD COLUMN "ever_clean" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Hand-written data step. Without it the column lands false everywhere, and any
-- player whose current best row is already clean would lose their seal on the
-- first resync — the migration would dig the very gap it closes. A row with zero
-- corrections IS proof of a "sans retouche" run, so the backfill reads it
-- straight off. Idempotent.
UPDATE "level_score" SET "ever_clean" = true WHERE "undos" = 0;
