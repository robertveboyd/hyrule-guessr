CREATE TYPE "public"."sp_run_mode" AS ENUM('casual', 'timed');--> statement-breakpoint
CREATE TABLE "sp_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"round_index" integer NOT NULL,
	"still_id" uuid NOT NULL,
	"guess_x" double precision,
	"guess_z" double precision,
	"score" integer,
	"distance_meters" integer,
	"locked_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sp_rounds_run_id_round_index_unique" UNIQUE("run_id","round_index")
);
--> statement-breakpoint
CREATE TABLE "sp_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" "sp_run_mode" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sp_runs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "sp_rounds" ADD CONSTRAINT "sp_rounds_run_id_sp_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sp_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sp_rounds" ADD CONSTRAINT "sp_rounds_still_id_stills_id_fk" FOREIGN KEY ("still_id") REFERENCES "public"."stills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sp_runs" ADD CONSTRAINT "sp_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;