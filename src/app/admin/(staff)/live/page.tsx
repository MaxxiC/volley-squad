import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { events, lineups, matchPlayers, matches, players } from "@/db/schema";
import { PageHeader } from "@/components/admin/page-header";
import { getCurrentSeason } from "@/lib/data";
import { formatShortDate, formatTime } from "@/lib/format";
import { matchTitle, roundLabel } from "@/lib/matches";
import type { PreparePlayer, PrepareSetup } from "./prepare-form";
import { PrepareWizard } from "./prepare-wizard";

export const metadata: Metadata = { title: "Live" };

/** Presenti e formazione del 1° set già salvati per una partita (null se non preparata). */
async function loadSetup(matchId: number): Promise<PrepareSetup | null> {
  const [present, lineup] = await Promise.all([
    db.select({ playerId: matchPlayers.playerId, role: matchPlayers.role }).from(matchPlayers).where(eq(matchPlayers.matchId, matchId)),
    db.query.lineups.findFirst({ where: and(eq(lineups.matchId, matchId), eq(lineups.setN, 1)) }),
  ]);
  if (!present.length) return null;
  return {
    present,
    slots: lineup ? [lineup.p1, lineup.p2, lineup.p3, lineup.p4, lineup.p5, lineup.p6] : [null, null, null, null, null, null],
    liberoId: lineup?.liberoId ?? null,
  };
}

export default async function LivePage({ searchParams }: { searchParams: Promise<{ partita?: string }> }) {
  const { partita } = await searchParams;
  const season = await getCurrentSeason();

  // Partite che si possono giocare: in corso o da giocare, in ordine di data (le "da definire" in fondo).
  const playable = await db.query.matches.findMany({
    where: and(eq(matches.seasonId, season.id), inArray(matches.status, ["live", "scheduled"])),
    orderBy: [asc(matches.startsAt), asc(matches.round)],
    with: { opponent: true },
  });
  const match =
    playable.find((m) => String(m.id) === partita) ?? playable.find((m) => m.status === "live") ?? playable[0];

  if (!match) {
    return <PageHeader title="Live" description="Nessuna partita da giocare: aggiungila da Partite." />;
  }

  // Ultima partita preparata prima di questa (per "Come ultima partita").
  const [lastPrepared] = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .where(and(eq(matches.seasonId, season.id), ne(matches.id, match.id)))
    .orderBy(desc(matches.startsAt))
    .limit(1);

  const [roster, current, last, [actions]] = await Promise.all([
    db.query.players.findMany({ where: eq(players.active, true), orderBy: [asc(players.number)] }),
    loadSetup(match.id),
    lastPrepared ? loadSetup(lastPrepared.id) : null,
    // Azioni registrate (non annullate): le conta l'avviso di "Azzera il Live".
    db.select({ n: count() }).from(events).where(and(eq(events.matchId, match.id), eq(events.deleted, false))),
  ]);

  const kicker = [roundLabel(match), match.startsAt && `${formatShortDate(match.startsAt)} · ${formatTime(match.startsAt)}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <PrepareWizard
      // Cambiando partita (o dopo l'azzeramento del Live) il wizard riparte da zero.
      key={`${match.id}-${match.status}`}
      match={{
        id: match.id,
        kicker,
        title: matchTitle(match.home, match.opponent.name),
        opponent: match.opponent.name,
        live: match.status === "live",
        actions: actions?.n ?? 0,
      }}
      choices={playable.map((m) => ({ id: m.id, label: `${roundLabel(m)} · ${matchTitle(m.home, m.opponent.name)}` }))}
      roster={roster.map(({ id, number, firstName, lastName, role, gender }): PreparePlayer => ({ id, number, firstName, lastName, role, gender }))}
      current={current}
      last={last}
    />
  );
}
