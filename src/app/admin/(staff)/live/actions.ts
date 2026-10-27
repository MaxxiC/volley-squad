"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, runBatch } from "@/db";
import { events, lineups, matchPlayers, matches, players } from "@/db/schema";
import { invalid, revalidatePublicPages, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/lib/auth-guard";
import type { StartMatchInput } from "./prepare-form";
import { StartMatchSchema } from "./prepare-schema";

/** Salva presenze (con ruolo di partita) e formazione del 1° set, e mette la partita "in corso". */
export async function startMatch(input: StartMatchInput): Promise<ActionResult<{ id: number }>> {
  await requireStaff();
  const parsed = StartMatchSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { matchId, present, slots, liberoId, serveFirst } = parsed.data;

  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!match) return { ok: false, error: "Partita non trovata, ricarica la pagina" };
  if (match.status === "finished") return { ok: false, error: "La partita è già conclusa" };
  // Con azioni già registrate si riprende il Live, non si riprepara (si perderebbe la coerenza).
  const started = await db.query.events.findFirst({ where: eq(events.matchId, matchId) });
  if (started) return { ok: false, error: "Il Live di questa partita è già iniziato: riprendilo" };

  const ids = present.map((p) => p.playerId);
  const known = await db.select({ id: players.id }).from(players).where(and(inArray(players.id, ids), eq(players.active, true)));
  if (known.length !== ids.length) return { ok: false, error: "Un presente non è più in rosa, ricarica la pagina" };

  const [p1, p2, p3, p4, p5, p6] = slots;
  await runBatch([
    db.delete(matchPlayers).where(eq(matchPlayers.matchId, matchId)),
    db.insert(matchPlayers).values(present.map((p) => ({ matchId, playerId: p.playerId, role: p.role }))),
    db.delete(lineups).where(eq(lineups.matchId, matchId)),
    db.insert(lineups).values({ matchId, setN: 1, p1, p2, p3, p4, p5, p6, liberoId, serveFirst }),
    db.update(matches).set({ status: "live" }).where(eq(matches.id, matchId)),
  ]);

  revalidatePublicPages();
  revalidatePath("/admin/partite");
  revalidatePath("/admin/live");
  return { ok: true, id: matchId };
}
