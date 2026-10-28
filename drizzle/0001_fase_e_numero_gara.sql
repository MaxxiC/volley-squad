CREATE TYPE "public"."match_phase" AS ENUM('andata', 'ritorno');--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "phase" "match_phase" DEFAULT 'andata' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "number" smallint;