// Dalle righe del database ai tipi del Live (pagina Live e chiusura della partita, lato server).
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, lineups } from "@/db/schema";
import type { LiveEvent, LiveLineup } from "./types";

/**
 * startId = id della formazione del 1° set: cambia a ogni "Inizia partita", quindi distingue questo
 * Live da uno precedente della stessa partita (es. partita di prova ripreparata).
 */
export async function loadLiveLog(matchId: number): Promise<{ lineups: LiveLineup[]; events: LiveEvent[]; startId: number | null }> {
  const [lineupRows, eventRows] = await Promise.all([
    db.select().from(lineups).where(eq(lineups.matchId, matchId)),
    db.select().from(events).where(eq(events.matchId, matchId)),
  ]);
  return {
    startId: lineupRows.find((l) => l.setN === 1)?.id ?? null,
    lineups: lineupRows.map((l) => ({
      setN: l.setN,
      slots: [l.p1, l.p2, l.p3, l.p4, l.p5, l.p6],
      liberoId: l.liberoId,
      serveFirst: l.serveFirst,
    })),
    events: eventRows.map((e) => ({
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
    })),
  };
}
