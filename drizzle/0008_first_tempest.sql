CREATE TYPE "public"."match_invite_kind" AS ENUM('player', 'spectator');--> statement-breakpoint
CREATE TYPE "public"."match_invite_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."match_mode" AS ENUM('private', 'ranked');--> statement-breakpoint
CREATE TYPE "public"."match_seat_role" AS ENUM('player_a', 'player_b', 'host_observer');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('lobby', 'live', 'cancelled', 'completed');--> statement-breakpoint
CREATE TABLE "match_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "match_invite_kind" DEFAULT 'player' NOT NULL,
	"status" "match_invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_invites_match_id_user_id_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "match_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"round_index" integer NOT NULL,
	"still_id" uuid NOT NULL,
	"multiplier" double precision NOT NULL,
	"guess_ax" double precision,
	"guess_az" double precision,
	"guess_bx" double precision,
	"guess_bz" double precision,
	"score_a" integer NOT NULL,
	"score_b" integer NOT NULL,
	"damage" integer NOT NULL,
	"loser_id" uuid,
	"resolved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_rounds_match_id_round_index_unique" UNIQUE("match_id","round_index")
);
--> statement-breakpoint
CREATE TABLE "match_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"role" "match_seat_role" NOT NULL,
	"user_id" uuid,
	"health" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_seats_match_id_role_unique" UNIQUE("match_id","role"),
	CONSTRAINT "match_seats_match_id_user_id_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "match_mode" DEFAULT 'private' NOT NULL,
	"status" "match_status" DEFAULT 'lobby' NOT NULL,
	"host_user_id" uuid NOT NULL,
	"lobby_expires_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"winner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_invites" ADD CONSTRAINT "match_invites_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_invites" ADD CONSTRAINT "match_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_still_id_stills_id_fk" FOREIGN KEY ("still_id") REFERENCES "public"."stills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_loser_id_users_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_seats" ADD CONSTRAINT "match_seats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_seats" ADD CONSTRAINT "match_seats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;