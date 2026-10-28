CREATE TYPE "public"."player_gender" AS ENUM('F', 'M');--> statement-breakpoint
ALTER TYPE "public"."match_status" ADD VALUE 'postponed';--> statement-breakpoint
ALTER TABLE "match_players" ADD COLUMN "role" "player_role" NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "forfeit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "gender" "player_gender";