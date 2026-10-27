import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { events, lineups, matchPlayers, matches, players } from "@/db/schema";
import { matchTitle, shortTeamName } from "@/lib/matches";
import type { LiveEvent, LiveLineup, LivePlayer } from "@/lib/live/types";
import { LiveBoard } from "./live-board";

export const metadata: Metadata = { title: "Live" };

export default async function LiveMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const id = Number((await params).matchId);
  if (!Number.isInteger(id)) notFound();
  const match = await db.query.matches.findFirst({ where: eq(matches.id, id), with: { opponent: true } });
  if (!match) notFound();

  const [lineupRows, present, eventRows] = await Promise.all([
    db.select().from(lineups).where(eq(lineups.matchId, id)),
    db
      .select({
        id: players.id,
        number: players.number,
        firstName: players.firstName,
        lastName: players.lastName,
        role: matchPlayers.role,
      })
      .from(matchPlayers)
      .innerJoin(players, eq(players.id, matchPlayers.playerId))
      .where(eq(matchPlayers.matchId, id))
      .orderBy(asc(players.number)),
    db.select().from(events).where(eq(events.matchId, id)),
  ]);
  // Senza formazione del 1° set il Live non può partire: si torna a prepararlo.
  if (!lineupRows.some((l) => l.setN === 1)) redirect(`/admin/live?partita=${id}`);

  const liveLineups: LiveLineup[] = lineupRows.map((l) => ({
    setN: l.setN,
    slots: [l.p1, l.p2, l.p3, l.p4, l.p5, l.p6],
    liberoId: l.liberoId,
    serveFirst: l.serveFirst,
  }));
  const liveEvents: LiveEvent[] = eventRows.map((e) => ({
    id: e.id,
    setN: e.setN,
    seq: e.seq,
    createdAt: e.createdAt.toISOString(),
    kind: e.kind,
    playerId: e.playerId,
    skill: e.skill,
    outcome: e.outcome,
    point: e.point,
    star: e.star,
    incomplete: e.incomplete,
    deleted: e.deleted,
    detail: (e.detail as LiveEvent["detail"]) ?? null,
  }));

  // Niente titolo grande: come nel design il Live parte dal tabellone (che ha già i nomi).
  return (
    <LiveBoard
      match={{ id, title: matchTitle(match.home, match.opponent.name), opponent: shortTeamName(match.opponent.name) }}
      players={present satisfies LivePlayer[]}
      lineups={liveLineups}
      initialEvents={liveEvents}
    />
  );
}
