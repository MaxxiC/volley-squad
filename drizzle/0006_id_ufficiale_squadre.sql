ALTER TABLE "teams" ADD COLUMN "official_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_officialId_unique" UNIQUE("official_id");