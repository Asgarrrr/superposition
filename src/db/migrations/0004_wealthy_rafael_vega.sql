-- Move the daily from one puzzle per day to three (one per difficulty tier).
-- daily_puzzle's key becomes (date, tier); daily_score gains tier, a matching
-- composite FK, and a per-tier unique leaderboard slot. Existing rows default to
-- tier 1 (the old single daily was the ~16-move "medium"), so (date, 1) pairs
-- stay unique and every existing score keeps pointing at a real puzzle row.
-- Order matters: drop the old FK/PK before reshaping, add columns before the
-- constraints that reference them.
ALTER TABLE "daily_score" DROP CONSTRAINT "daily_score_date_daily_puzzle_date_fk";--> statement-breakpoint
DROP INDEX "daily_score_date_user";--> statement-breakpoint
ALTER TABLE "daily_puzzle" ADD COLUMN "tier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_puzzle" DROP CONSTRAINT "daily_puzzle_pkey";--> statement-breakpoint
ALTER TABLE "daily_puzzle" ADD CONSTRAINT "daily_puzzle_date_tier_pk" PRIMARY KEY("date","tier");--> statement-breakpoint
ALTER TABLE "daily_score" ADD COLUMN "tier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_score" ADD CONSTRAINT "daily_score_date_tier_daily_puzzle_date_tier_fk" FOREIGN KEY ("date","tier") REFERENCES "public"."daily_puzzle"("date","tier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_score_date_tier_user" ON "daily_score" USING btree ("date","tier","user_id");
