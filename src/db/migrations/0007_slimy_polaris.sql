CREATE TABLE "daily_view" (
	"date" text NOT NULL,
	"tier" integer NOT NULL,
	"user_id" text NOT NULL,
	"served_at" timestamp DEFAULT now() NOT NULL,
	"certified" boolean NOT NULL,
	CONSTRAINT "daily_view_date_tier_user_id_pk" PRIMARY KEY("date","tier","user_id")
);
--> statement-breakpoint
ALTER TABLE "daily_score" ADD COLUMN "elapsed_ms" integer DEFAULT 1800000 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_view" ADD CONSTRAINT "daily_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;