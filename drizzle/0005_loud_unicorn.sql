ALTER TABLE "sp_runs" ADD COLUMN "current_round_index" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sp_runs" ADD COLUMN "in_summary" boolean DEFAULT false NOT NULL;