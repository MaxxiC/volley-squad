// Sincronizzazione del Live: riceve un lotto di eventi e li salva per id (upsert idempotente).
// Rimandare lo stesso lotto non crea doppioni: è la base per l'offline (coda che si svuota quando torna la rete).
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { isForeignKeyViolation } from "@/db/errors";
import { events, matches } from "@/db/schema";
import { EventBatchSchema } from "@/lib/live/event-schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const matchId = Number((await params).id);
  if (!Number.isInteger(matchId)) return NextResponse.json({ error: "Partita non valida" }, { status: 400 });
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId), columns: { id: true, status: true } });
  if (!match) return NextResponse.json({ error: "Partita non trovata" }, { status: 404 });
  // A partita conclusa le azioni si correggono dallo Storico: un telefono rimasto indietro non le sovrascrive.
  // 422: il Live mette da parte le azioni e non riprova.
  if (match.status === "finished") {
    return NextResponse.json({ error: "Partita conclusa: le azioni si correggono dallo Storico" }, { status: 422 });
  }

  const parsed = EventBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Eventi non validi" }, { status: 400 });
  }

  const rows = parsed.data.events.map((e) => ({ ...e, matchId, createdAt: new Date(e.createdAt) }));
  try {
    await upsert(rows, matchId);
  } catch (err) {
    // Dato non valido (es. giocatore inesistente): 422, così il client non riprova all'infinito.
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: "Evento con un giocatore non valido" }, { status: 422 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}

async function upsert(rows: (typeof events.$inferInsert)[], matchId: number) {
  const excluded = (column: string) => sql.raw(`excluded.${column}`);
  await db
    .insert(events)
    .values(rows)
    .onConflictDoUpdate({
      target: events.id,
      set: {
        setN: excluded("set_n"),
        seq: excluded("seq"),
        kind: excluded("kind"),
        playerId: excluded("player_id"),
        skill: excluded("skill"),
        outcome: excluded("outcome"),
        point: excluded("point"),
        star: excluded("star"),
        incomplete: excluded("incomplete"),
        deleted: excluded("deleted"),
        detail: excluded("detail"),
      },
      // Un id già usato in un'altra partita non viene sovrascritto.
      setWhere: sql`${events.matchId} = ${matchId}`,
    });
}
