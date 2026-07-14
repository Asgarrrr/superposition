CREATE TABLE "level_score" (
	"id" serial PRIMARY KEY NOT NULL,
	"level_id" text NOT NULL,
	"user_id" text NOT NULL,
	"moves" integer NOT NULL,
	"inputs" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "level_score" ADD CONSTRAINT "level_score_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "level_score_level_user" ON "level_score" USING btree ("level_id","user_id");