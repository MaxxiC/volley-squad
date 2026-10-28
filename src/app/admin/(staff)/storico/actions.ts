"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, runBatch } from "@/db";
import { events, matchPlayers, matchSets, matches } from "@/db/schema";
import { invalid, revalidatePublicPages, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/lib/auth-guard";
import { loadLiveLog } from "@/lib/live/db";
import { computeLive } from "@/lib/live/state";
import { applyEdit, editIssue, finishedIssue, insertSeq, isDeletable, isEditable, type ActionEdit } from "@/lib/live/storico";
import type { LiveEvent } from "@/lib/live/types";
import type { AddEventInput, DeleteEventInput, SaveEventInput } from "./storico-form";
import { AddEventSchema, DeleteEventSchema, SaveEventSchema } from "./storico-schema";

type Log = Awaited<ReturnType<typeof loadLiveLog>>;
type Write = Parameters<typeof runBatch>[0][number];

/** Partita conclusa e suo registro: lo Storico corregge solo le partite concluse. */
async function finishedLog(matchId: number): Promise<{ ok: true; log: Log } | { ok: false; error: string }> {
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId), columns: { status: true } });
  if (!match) return { ok: false, error: "Partita non trovata, ricarica la pagina" };
  if (match.status !== "finished") return { ok: false, error: "Si correggono solo le partite concluse" };
  return { ok: true, log: await loadLiveLog(matchId) };
}

/** Il giocatore scelto deve essere tra i presenti della partita. */
async function checkEdit(matchId: number, edit: ActionEdit): Promise<string | null> {
  const issue = editIssue(edit);
  if (issue) return issue;
  if (edit.playerId === null) return null;
  const present = await db.query.matchPlayers.findFirst({
    where: and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerId, edit.playerId)),
  });
  return present ? null : "Il giocatore deve essere tra i presenti della partita";
}

/**
 * Scrive la correzione insieme ai parziali ricalcolati da tutto il registro (in una transazione).
 * Se con la correzione la partita non risulta più finita o un set chiuso non ha un punteggio di
 * fine set, non si scrive nulla.
 */
async function commit(matchId: number, log: Log, next: LiveEvent[], writes: Write[]) {
  const live = computeLive(log.lineups, next);
  const issue = finishedIssue(live);
  if (issue || !live) return { ok: false as const, error: issue ?? "Partita non valida" };
  await runBatch([
    ...writes,
    db.delete(matchSets).where(eq(matchSets.matchId, matchId)),
    db.insert(matchSets).values(live.finishedSets.map((s) => ({ matchId, n: s.n, us: s.us, them: s.them }))),
  ]);
  revalidatePublicPages();
  revalidatePath("/admin/storico");
  revalidatePath("/admin/partite");
  revalidatePath("/admin/giocatori");
  return null;
}

const columns = (e: LiveEvent) => ({
  playerId: e.playerId,
  skill: e.skill,
  outcome: e.outcome,
  point: e.point,
  star: e.star,
  incomplete: e.incomplete,
  detail: e.detail,
});

export async function saveEvent(input: SaveEventInput): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = SaveEventSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { matchId, eventId, edit } = parsed.data;

  const found = await finishedLog(matchId);
  if (!found.ok) return found;
  const event = found.log.events.find((e) => e.id === eventId && !e.deleted);
  if (!event || !isEditable(event)) return { ok: false, error: "Azione non trovata, ricarica la pagina" };
  const issue = await checkEdit(matchId, edit);
  if (issue) return { ok: false, error: issue };

  const updated = applyEdit(event, edit);
  const next = found.log.events.map((e) => (e.id === eventId ? updated : e));
  const failed = await commit(matchId, found.log, next, [
    db.update(events).set(columns(updated)).where(and(eq(events.id, eventId), eq(events.matchId, matchId))),
  ]);
  return failed ?? { ok: true, id: eventId };
}

/** Elimina come nel Live: l'evento resta nel registro segnato come annullato. */
export async function deleteEvent(input: DeleteEventInput): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = DeleteEventSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { matchId, eventId } = parsed.data;

  const found = await finishedLog(matchId);
  if (!found.ok) return found;
  const event = found.log.events.find((e) => e.id === eventId && !e.deleted);
  if (!event || !isDeletable(event)) return { ok: false, error: "Questa voce non si può eliminare dallo Storico" };

  const next = found.log.events.map((e) => (e.id === eventId ? { ...e, deleted: true } : e));
  const failed = await commit(matchId, found.log, next, [
    db.update(events).set({ deleted: true }).where(and(eq(events.id, eventId), eq(events.matchId, matchId))),
  ]);
  return failed ?? { ok: true, id: eventId };
}

export async function addEvent(input: AddEventInput): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = AddEventSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { matchId, setN, afterId, edit } = parsed.data;

  const found = await finishedLog(matchId);
  if (!found.ok) return found;
  const after = afterId ? found.log.events.find((e) => e.id === afterId && !e.deleted) : null;
  if (afterId && (!after || after.setN !== setN)) return { ok: false, error: "Azione di riferimento non trovata, ricarica la pagina" };
  if (!found.log.events.some((e) => e.setN === setN)) return { ok: false, error: "Set non trovato" };
  const issue = await checkEdit(matchId, edit);
  if (issue) return { ok: false, error: issue };

  // L'ordine è dato da seq: si fa posto spostando di 1 gli eventi successivi.
  const seq = insertSeq(found.log.events, setN, afterId);
  const blank: LiveEvent = {
    id: randomUUID(),
    setN,
    seq,
    createdAt: new Date().toISOString(),
    kind: "action",
    playerId: null,
    skill: null,
    outcome: null,
    point: null,
    star: false,
    incomplete: true,
    deleted: false,
    detail: null,
  };
  const added = applyEdit(blank, edit);
  const next = [...found.log.events.map((e) => (e.seq >= seq ? { ...e, seq: e.seq + 1 } : e)), added];
  const failed = await commit(matchId, found.log, next, [
    db.update(events).set({ seq: sql`${events.seq} + 1` }).where(and(eq(events.matchId, matchId), gte(events.seq, seq))),
    db.insert(events).values({ ...added, matchId, createdAt: new Date(added.createdAt) }),
  ]);
  return failed ?? { ok: true, id: added.id };
}
