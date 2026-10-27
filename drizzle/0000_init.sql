CREATE TYPE "public"."event_kind" AS ENUM('action', 'sub', 'rotation', 'set_end');--> statement-breakpoint
CREATE TYPE "public"."event_skill" AS ENUM('serve', 'reception', 'set', 'attack', 'block', 'fault', 'opp_error', 'opp_point');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'finished');--> statement-breakpoint
CREATE TYPE "public"."player_role" AS ENUM('P', 'S', 'O', 'C', 'L');--> statement-breakpoint
CREATE TYPE "public"."point_side" AS ENUM('us', 'them');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'coach');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"set_n" smallint NOT NULL,
	"seq" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "event_kind" NOT NULL,
	"player_id" integer,
	"skill" "event_skill",
	"outcome" text,
	"point" "point_side",
	"star" boolean DEFAULT false NOT NULL,
	"incomplete" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "lineups" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"set_n" smallint NOT NULL,
	"p1" integer NOT NULL,
	"p2" integer NOT NULL,
	"p3" integer NOT NULL,
	"p4" integer NOT NULL,
	"p5" integer NOT NULL,
	"p6" integer NOT NULL,
	"libero_id" integer
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	CONSTRAINT "match_players_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "match_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"n" smallint NOT NULL,
	"us" smallint NOT NULL,
	"them" smallint NOT NULL,
	CONSTRAINT "match_sets_n_range" CHECK ("match_sets"."n" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"round" smallint NOT NULL,
	"starts_at" timestamp with time zone,
	"home" boolean NOT NULL,
	"opponent_id" integer NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"mvp_player_id" integer
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" smallint NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" "player_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"points" smallint DEFAULT 0 NOT NULL,
	"played" smallint DEFAULT 0 NOT NULL,
	"won" smallint DEFAULT 0 NOT NULL,
	"lost" smallint DEFAULT 0 NOT NULL,
	"sets_won" smallint DEFAULT 0 NOT NULL,
	"sets_lost" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_us" boolean DEFAULT false NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p1_players_id_fk" FOREIGN KEY ("p1") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p2_players_id_fk" FOREIGN KEY ("p2") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p3_players_id_fk" FOREIGN KEY ("p3") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p4_players_id_fk" FOREIGN KEY ("p4") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p5_players_id_fk" FOREIGN KEY ("p5") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p6_players_id_fk" FOREIGN KEY ("p6") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_libero_id_players_id_fk" FOREIGN KEY ("libero_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_opponent_id_teams_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_mvp_player_id_players_id_fk" FOREIGN KEY ("mvp_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_match_set_seq" ON "events" USING btree ("match_id","set_n","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "lineups_match_set" ON "lineups" USING btree ("match_id","set_n");--> statement-breakpoint
CREATE UNIQUE INDEX "match_sets_match_n" ON "match_sets" USING btree ("match_id","n");--> statement-breakpoint
CREATE INDEX "matches_season_starts" ON "matches" USING btree ("season_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_current" ON "seasons" USING btree ("is_current") WHERE "seasons"."is_current";--> statement-breakpoint
CREATE UNIQUE INDEX "standings_season_team" ON "standings" USING btree ("season_id","team_id");