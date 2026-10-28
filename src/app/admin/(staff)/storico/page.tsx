import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { events, matchPlayers, matchSets, matches, players } from "@/db/schema";
import { PageHeader } from "@/components/admin/page-header";
import { getCurrentSeason } from "@/lib/data";
import { formatShortDate } from "@/lib/format";
import { loadLiveLog } from "@/lib/live/db";
import type { LivePlayer } from "@/lib/live/types";
import { matchScore, shortTeamName } from "@/lib/matches";
import { StoricoBoard, type StoricoTab } from "./storico-board";

export const metadata: Metadata = { title: "Storico live" };

const KICKER = "Correggi i dati registrati";

export default async function StoricoPage({ searchParams }: { searchParams: Promise<{ partita?: string }> }) {
  const { partita } = await searchParams;
  const season = await getCurrentSeason();

  // Partite registrate con il Live (con almeno un'azione), dalla più recente.
  const recorded = await db
    .selectDistinct({ id: matches.id, startsAt: matches.startsAt })
    .from(matches)
    .innerJoin(events, eq(events.matchId, matches.id))
    .where(and(eq(matches.seasonId, season.id), inArray(matches.status, ["finished", "live"])))
    .orderBy(desc(matches.startsAt));
  const ids = recorded.map((m) => m.id);
  if (!ids.length) {
    return (
      <PageHeader
        kicker={KICKER}
        title="Storico live"
        description="Nessuna partita registrata con il Live: lo Storico si riempie con le partite giocate dal Live."
      />
    );
  }

  const [list, sets] = await Promise.all([
    db.query.matches.findMany({ where: inArray(matches.id, ids), with: { opponent: true } }),
    db.select().from(matchSets).where(inArray(matchSets.matchId, ids)).orderBy(asc(matchSets.n)),
  ]);
  const byId = new Map(list.map((m) => [m.id, m]));
  const tabs: StoricoTab[] = ids.map((id) => {
    const m = byId.get(id)!;
    const score = matchScore(sets.filter((s) => s.matchId === id));
    const when = m.startsAt ? formatShortDate(m.startsAt) : "data da definire";
    return {
      id,
      label: `${m.home ? "vs " : ""}${shortTeamName(m.opponent.name)}`,
      sub: m.status === "live" ? `${when} · in corso` : `${when} · ${score.us}–${score.them}`,
    };
  });
  const match = byId.get(Number(partita)) ?? byId.get(ids[0])!;

  const [log, present] = await Promise.all([
    loadLiveLog(match.id),
    db
      .select({
        id: players.id,
        number: players.number,
        firstName: players.firstName,
        lastName: players.lastName,
        role: matchPlayers.role,
        gender: players.gender,
      })
      .from(matchPlayers)
      .innerJoin(players, eq(players.id, matchPlayers.playerId))
      .where(eq(matchPlayers.matchId, match.id))
      .orderBy(asc(players.number)),
  ]);

  return (
    <div className="flex flex-col gap-5.5">
      <PageHeader kicker={KICKER} title="Storico live" />
      <StoricoBoard
        // Cambiando partita lo stato (set, filtro, riga aperta) riparte da zero.
        key={match.id}
        tabs={tabs}
        match={{ id: match.id, opponent: shortTeamName(match.opponent.name), finished: match.status === "finished" }}
        players={present satisfies LivePlayer[]}
        lineups={log.lineups}
        events={log.events}
      />
    </div>
  );
}
