import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { events, matchPlayers, matches, players } from "@/db/schema";
import { getCurrentSeason } from "@/lib/data";
import type { EventDetail } from "@/lib/live/types";
import { PLAYER_ROLES, type PlayerRole } from "@/lib/players";
import { countsByPlayer, emptyCounts, matchRoles, mergeCounts, skillLines, type Counts } from "@/lib/stats";
import type { AdminPlayer, PlayerStats } from "./player-form";
import { PlayersManager } from "./players-manager";

export const metadata: Metadata = { title: "Giocatori" };

export default async function GiocatoriPage() {
  const season = await getCurrentSeason();
  const inSeason = eq(matches.seasonId, season.id);

  // Conteggi della stagione corrente, per giocatore.
  const [roster, presences, stars, mvps, [played]] = await Promise.all([
    db.query.players.findMany({ orderBy: [desc(players.active), asc(players.number)] }),
    db
      .select({ id: matchPlayers.playerId, n: count() })
      .from(matchPlayers)
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(inSeason)
      .groupBy(matchPlayers.playerId),
    db
      .select({ id: events.playerId, n: count() })
      .from(events)
      .innerJoin(matches, eq(matches.id, events.matchId))
      .where(and(inSeason, eq(events.star, true), eq(events.deleted, false)))
      .groupBy(events.playerId),
    db.select({ id: matches.mvpPlayerId, n: count() }).from(matches).where(inSeason).groupBy(matches.mvpPlayerId),
    db.select({ n: count() }).from(matches).where(and(inSeason, eq(matches.status, "finished"))),
  ]);

  const statsOf = await seasonStats(season.id);
  const countOf = (rows: { id: number | null; n: number }[], id: number) => rows.find((r) => r.id === id)?.n ?? 0;
  const list: AdminPlayer[] = roster.map((p) => ({
    ...p,
    presences: countOf(presences, p.id),
    stars: countOf(stars, p.id),
    mvp: countOf(mvps, p.id),
    stats: statsOf(p.id),
  }));

  return <PlayersManager players={list} matchesPlayed={played.n} />;
}

/**
 * Statistiche per giocatore dalle partite concluse della stagione registrate con il Live (quelle col
 * solo risultato non hanno azioni). Ogni partita conta nel ruolo che il giocatore aveva quel giorno.
 */
async function seasonStats(seasonId: number): Promise<(playerId: number) => PlayerStats> {
  const finished = await db
    .selectDistinct({ id: matches.id })
    .from(matches)
    .innerJoin(events, eq(events.matchId, matches.id))
    .where(and(eq(matches.seasonId, seasonId), eq(matches.status, "finished")));
  const ids = finished.map((m) => m.id);
  const empty: PlayerStats = { matches: 0, roles: [], lines: {} };
  if (!ids.length) return () => empty;

  const [present, rows] = await Promise.all([
    db.select({ matchId: matchPlayers.matchId, playerId: matchPlayers.playerId, role: matchPlayers.role }).from(matchPlayers).where(inArray(matchPlayers.matchId, ids)),
    db
      .select({
        matchId: events.matchId,
        seq: events.seq,
        kind: events.kind,
        playerId: events.playerId,
        skill: events.skill,
        outcome: events.outcome,
        deleted: events.deleted,
        detail: events.detail,
      })
      .from(events)
      .where(and(inArray(events.matchId, ids), inArray(events.kind, ["action", "sub"]), eq(events.deleted, false))),
  ]);

  // Per giocatore: una voce per partita, con il ruolo di quel giorno e i conteggi.
  const played = new Map<number, { role: PlayerRole; counts: Counts }[]>();
  for (const matchId of ids) {
    const evs = rows.filter((r) => r.matchId === matchId).map((r) => ({ ...r, detail: r.detail as EventDetail | null }));
    const roles = matchRoles(present.filter((p) => p.matchId === matchId), evs);
    const counts = countsByPlayer(evs);
    for (const [playerId, role] of roles) {
      played.set(playerId, [...(played.get(playerId) ?? []), { role, counts: counts.get(playerId) ?? emptyCounts() }]);
    }
  }

  return (playerId) => {
    const list = played.get(playerId);
    if (!list) return empty;
    const roles = PLAYER_ROLES.flatMap((role) => {
      const n = list.filter((m) => m.role === role).length;
      return n ? [{ role, matches: n }] : [];
    }).sort((a, b) => b.matches - a.matches);
    const lines: PlayerStats["lines"] = { all: skillLines(mergeCounts(list.map((m) => m.counts)), roles.map((r) => r.role)) };
    if (roles.length > 1) {
      for (const { role } of roles) lines[role] = skillLines(mergeCounts(list.filter((m) => m.role === role).map((m) => m.counts)), [role]);
    }
    return { matches: list.length, roles, lines };
  };
}
