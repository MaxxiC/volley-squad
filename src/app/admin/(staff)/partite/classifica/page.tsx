import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { getCurrentSeason, getStandings } from "@/lib/data";
import { StandingsEditor } from "./standings-editor";

export const metadata: Metadata = { title: "Classifica" };

export default async function ClassificaPage() {
  const season = await getCurrentSeason();
  const [rows, allTeams] = await Promise.all([
    getStandings(season.id),
    db.query.teams.findMany({ orderBy: [asc(teams.name)] }),
  ]);

  return (
    <StandingsEditor
      seasonName={season.name}
      teamNames={allTeams.map((t) => t.name)}
      initial={rows.map((r) => ({
        key: String(r.id),
        team: r.team.name,
        points: String(r.points),
        won: String(r.won),
        lost: String(r.lost),
        setsWon: String(r.setsWon),
        setsLost: String(r.setsLost),
      }))}
    />
  );
}
