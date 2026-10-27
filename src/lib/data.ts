// Letture per le pagine pubbliche.
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { matches, seasons, standings, teams } from "@/db/schema";
import type { MatchWithDetails, Season, StandingRow, Team } from "./types";

export async function getCurrentSeason(): Promise<Season> {
  const season = await db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true) });
  if (!season) throw new Error("Nessuna stagione corrente");
  return season;
}

export async function getUsTeam(): Promise<Team> {
  const us = await db.query.teams.findFirst({ where: eq(teams.isUs, true) });
  if (!us) throw new Error("Squadra CUSBros non trovata");
  return us;
}

/** Partite della stagione con data fissata, in ordine cronologico, con avversario e parziali. */
export async function getSeasonMatches(seasonId: number): Promise<MatchWithDetails[]> {
  const rows = await db.query.matches.findMany({
    where: and(eq(matches.seasonId, seasonId), isNotNull(matches.startsAt)),
    orderBy: [asc(matches.startsAt)],
    with: { opponent: true, sets: { orderBy: (s, { asc }) => [asc(s.n)] } },
  });
  return rows.flatMap((m) => (m.startsAt ? [{ ...m, startsAt: m.startsAt }] : []));
}

/** Classifica ordinata: punti, vittorie, quoziente set. */
export async function getStandings(seasonId: number): Promise<StandingRow[]> {
  const rows = await db.query.standings.findMany({
    where: eq(standings.seasonId, seasonId),
    with: { team: true },
  });
  const setRatio = (s: StandingRow) => (s.setsLost === 0 ? Infinity : s.setsWon / s.setsLost);
  return rows.sort((a, b) => b.points - a.points || b.won - a.won || setRatio(b) - setRatio(a));
}
