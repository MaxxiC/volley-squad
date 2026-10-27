import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { events, matchPlayers, matches, players } from "@/db/schema";
import { getCurrentSeason } from "@/lib/data";
import type { AdminPlayer } from "./player-form";
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

  const countOf = (rows: { id: number | null; n: number }[], id: number) => rows.find((r) => r.id === id)?.n ?? 0;
  const list: AdminPlayer[] = roster.map((p) => ({
    ...p,
    presences: countOf(presences, p.id),
    stars: countOf(stars, p.id),
    mvp: countOf(mvps, p.id),
  }));

  return <PlayersManager players={list} matchesPlayed={played.n} />;
}
