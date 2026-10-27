// Livello di accesso ai dati. Per ora legge i mock; nello step 2 le stesse funzioni
// interrogheranno Neon con Drizzle, senza cambiare firme né pagine.
import { matchSets, matches, seasons, standings, teams } from "./mock-data";
import type { MatchWithDetails, Season, StandingRow, Team } from "./types";

function teamById(id: number): Team {
  const team = teams.find((t) => t.id === id);
  if (!team) throw new Error(`Squadra ${id} non trovata`);
  return team;
}

export async function getCurrentSeason(): Promise<Season> {
  const season = seasons.find((s) => s.isCurrent);
  if (!season) throw new Error("Nessuna stagione corrente");
  return season;
}

export async function getUsTeam(): Promise<Team> {
  const us = teams.find((t) => t.isUs);
  if (!us) throw new Error("Squadra CUSBros non trovata");
  return us;
}

/** Partite della stagione in ordine cronologico, con avversario e parziali. */
export async function getSeasonMatches(seasonId: number): Promise<MatchWithDetails[]> {
  return matches
    .filter((m) => m.seasonId === seasonId)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((m) => ({
      ...m,
      opponent: teamById(m.opponentId),
      sets: matchSets.filter((s) => s.matchId === m.id).sort((a, b) => a.n - b.n),
    }));
}

/** Classifica ordinata: punti, vittorie, quoziente set. */
export async function getStandings(seasonId: number): Promise<StandingRow[]> {
  const setRatio = (s: StandingRow) => (s.setsLost === 0 ? Infinity : s.setsWon / s.setsLost);
  return standings
    .filter((s) => s.seasonId === seasonId)
    .map((s) => ({ ...s, team: teamById(s.teamId) }))
    .sort((a, b) => b.points - a.points || b.won - a.won || setRatio(b) - setRatio(a));
}
