import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { matchPlayers, matches, players } from "@/db/schema";
import { loadLiveLog } from "@/lib/live/db";
import type { LivePlayer } from "@/lib/live/types";
import { matchTitle, shortTeamName } from "@/lib/matches";
import { LiveBoard } from "./live-board";

export const metadata: Metadata = { title: "Live" };

export default async function LiveMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const id = Number((await params).matchId);
  if (!Number.isInteger(id)) notFound();
  const match = await db.query.matches.findFirst({ where: eq(matches.id, id), with: { opponent: true } });
  if (!match) notFound();

  const [log, present] = await Promise.all([
    loadLiveLog(id),
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
      .where(eq(matchPlayers.matchId, id))
      .orderBy(asc(players.number)),
  ]);
  // Senza formazione del 1° set il Live non può partire: si torna a prepararlo.
  if (!log.lineups.some((l) => l.setN === 1)) redirect(`/admin/live?partita=${id}`);

  // Niente titolo grande: come nel design il Live parte dal tabellone (che ha già i nomi).
  return (
    <LiveBoard
      match={{
        id,
        title: matchTitle(match.home, match.opponent.name),
        opponent: shortTeamName(match.opponent.name),
        finished: match.status === "finished",
      }}
      players={present satisfies LivePlayer[]}
      lineups={log.lineups}
      startId={log.startId}
      initialEvents={log.events}
    />
  );
}
