import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { events, matchPlayers, matches, players } from "@/db/schema";
import { getCurrentSeason } from "@/lib/data";
import { formatShortDate } from "@/lib/format";
import type { EventDetail } from "@/lib/live/types";
import { PLAYER_ROLES, type PlayerRole } from "@/lib/players";
import { STAT_SKILLS, countsByPlayer, efficiency, emptyCounts, matchRoles, mergeCounts, skillLines, type Counts } from "@/lib/stats";
import { roundLabel, shortTeamName } from "@/lib/matches";
import type { AdminPlayer, PlayerStats, TrendMatch } from "./player-form";
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
  const empty: PlayerStats = { matches: 0, roles: [], lines: {}, trend: [] };
  if (!finished.length) return () => empty;

  // In ordine di data: è l'ordine del grafico Andamento.
  const list = await db.query.matches.findMany({
    where: inArray(
      matches.id,
      finished.map((m) => m.id),
    ),
    with: { opponent: true },
    orderBy: [asc(matches.startsAt), asc(matches.round)],
  });
  const ids = list.map((m) => m.id);
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
  const played = new Map<number, { role: PlayerRole; counts: Counts; label: string; title: string }[]>();
  for (const m of list) {
    const evs = rows.filter((r) => r.matchId === m.id).map((r) => ({ ...r, detail: r.detail as EventDetail | null }));
    const roles = matchRoles(present.filter((p) => p.matchId === m.id), evs);
    const counts = countsByPlayer(evs);
    const label = `${m.phase === "andata" ? "A" : "R"}${m.round}`;
    const title = [roundLabel(m), `${m.home ? "vs " : ""}${shortTeamName(m.opponent.name)}`, m.startsAt && formatShortDate(m.startsAt)]
      .filter(Boolean)
      .join(" · ");
    for (const [playerId, role] of roles) {
      played.set(playerId, [...(played.get(playerId) ?? []), { role, counts: counts.get(playerId) ?? emptyCounts(), label, title }]);
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
    const trend: TrendMatch[] = list.map((m) => ({
      label: m.label,
      title: m.title,
      role: m.role,
      skills: Object.fromEntries(
        STAT_SKILLS.flatMap((skill) => {
          const eff = efficiency(skill, m.counts);
          const total = Object.values(m.counts[skill]).reduce((a, b) => a + b, 0);
          return eff === null ? [] : [[skill, { eff, total }]];
        }),
      ),
    }));
    return { matches: list.length, roles, lines, trend };
  };
}
