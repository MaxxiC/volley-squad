// Letture per la pagina pubblica Statistiche (solo server).
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { events, matchPlayers, matches, players } from "@/db/schema";
import { formatShortDate } from "./format";
import type { PlayerRole } from "./players";
import { loadLiveLog } from "./live/db";
import { activeEvents } from "./live/state";
import { matchScore, roundLabel, shortTeamName } from "./matches";
import { matchStat, type MatchStat } from "./stats-season";

export type StatsPlayer = { id: number; number: number; firstName: string; lastName: string; role: PlayerRole };

/**
 * Partite concluse della stagione registrate col Live (quelle col solo risultato non hanno azioni),
 * in ordine di data, con i numeri di ciascuna; e i giocatori che vi compaiono.
 */
export async function getSeasonStats(seasonId: number): Promise<{ matches: MatchStat[]; players: StatsPlayer[] }> {
  const recorded = await db
    .selectDistinct({ id: matches.id })
    .from(matches)
    .innerJoin(events, eq(events.matchId, matches.id))
    .where(and(eq(matches.seasonId, seasonId), eq(matches.status, "finished"), eq(events.kind, "action"), eq(events.deleted, false)));
  if (!recorded.length) return { matches: [], players: [] };
  const ids = recorded.map((m) => m.id);

  const [list, present] = await Promise.all([
    db.query.matches.findMany({
      where: inArray(matches.id, ids),
      with: { opponent: true, sets: { orderBy: (s, { asc }) => [asc(s.n)] } },
      orderBy: [asc(matches.startsAt), asc(matches.round)],
    }),
    db.select({ matchId: matchPlayers.matchId, playerId: matchPlayers.playerId, role: matchPlayers.role }).from(matchPlayers).where(inArray(matchPlayers.matchId, ids)),
  ]);
  const logs = await Promise.all(list.map((m) => loadLiveLog(m.id)));

  const stats = list.map((m, i) => {
    const score = matchScore(m.sets);
    const title = [roundLabel(m), `${m.home ? "vs " : "@ "}${shortTeamName(m.opponent.name)}`, m.startsAt && formatShortDate(m.startsAt)]
      .filter(Boolean)
      .join(" · ");
    return matchStat(
      {
        id: m.id,
        label: `${m.phase === "andata" ? "A" : "R"}${m.round}`,
        title,
        result: `${score.us}–${score.them}`,
        won: score.won,
        total: { us: m.sets.reduce((t, s) => t + s.us, 0), them: m.sets.reduce((t, s) => t + s.them, 0) },
      },
      logs[i].lineups,
      activeEvents(logs[i].events),
      present.filter((p) => p.matchId === m.id),
    );
  });

  const playerIds = [...new Set(stats.flatMap((m) => Object.keys(m.players).map(Number)))];
  const roster = playerIds.length
    ? await db
        .select({ id: players.id, number: players.number, firstName: players.firstName, lastName: players.lastName, role: players.role })
        .from(players)
        .where(inArray(players.id, playerIds))
    : [];
  return { matches: stats, players: roster };
}
