"use server";

import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { matchSets, matches } from "@/db/schema";
import { requireStaff } from "@/lib/auth-guard";
import { getCurrentSeason } from "@/lib/data";
import { fromRomeInput } from "@/lib/format";
import { findOrCreateTeam } from "@/lib/teams";
import { HOME_VENUE } from "@/lib/club";
import { MatchFormSchema, type MatchFormInput } from "./match-form";

export type ActionResult = { ok: true; id: number } | { ok: false; error: string };

function revalidateMatches() {
  revalidatePath("/");
  revalidatePath("/calendario");
  revalidatePath("/admin/partite");
}

export async function saveMatch(input: MatchFormInput): Promise<ActionResult> {
  await requireStaff();
  const parsed = MatchFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const form = parsed.data;

  const opponent = await findOrCreateTeam(form.opponent);
  if (opponent.isUs) return { ok: false, error: "L'avversario non può essere CUSBros" };
  const opponentId = opponent.id;

  const won = form.sets.filter((s) => s.us > s.them).length;
  const finished = won === 3 || form.sets.length - won === 3;
  const fields = {
    phase: form.phase,
    round: form.round,
    number: form.number,
    startsAt: form.date ? fromRomeInput(form.date, form.time) : null,
    home: form.home,
    opponentId,
    venue: form.venue,
  };

  let matchId: number;
  if (form.id) {
    const current = await db.query.matches.findFirst({ where: eq(matches.id, form.id) });
    if (!current) return { ok: false, error: "Partita non trovata, ricarica la pagina" };
    matchId = current.id;
    // Una partita in corso nel Live resta "live": la chiude il Live.
    const status = current.status === "live" ? "live" : finished ? "finished" : "scheduled";
    await db.update(matches).set({ ...fields, status }).where(eq(matches.id, matchId));
  } else {
    const season = await getCurrentSeason();
    const [created] = await db
      .insert(matches)
      .values({ ...fields, seasonId: season.id, status: finished ? "finished" : "scheduled" })
      .returning({ id: matches.id });
    matchId = created.id;
  }

  // Parziali riscritti in blocco (batch = transazione su Neon).
  const setQueries: BatchItem<"pg">[] = [db.delete(matchSets).where(eq(matchSets.matchId, matchId))];
  if (form.sets.length) {
    setQueries.push(db.insert(matchSets).values(form.sets.map((s, i) => ({ matchId, n: i + 1, ...s }))));
  }
  await db.batch(setQueries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  revalidateMatches();
  return { ok: true, id: matchId };
}

export async function deleteMatch(id: number): Promise<ActionResult> {
  await requireStaff();
  // Parziali, presenze, formazioni ed eventi si cancellano a cascata.
  const deleted = await db.delete(matches).where(eq(matches.id, id)).returning({ id: matches.id });
  if (!deleted.length) return { ok: false, error: "Partita non trovata, ricarica la pagina" };
  revalidateMatches();
  return { ok: true, id };
}

/**
 * Crea il ritorno: stessa giornata nell'altra fase (andata 2ª → ritorno 2ª), stesso avversario,
 * casa/trasferta invertite, data e numero gara da definire.
 */
export async function duplicateAsReturn(id: number): Promise<ActionResult> {
  await requireStaff();
  const source = await db.query.matches.findFirst({ where: eq(matches.id, id) });
  if (!source) return { ok: false, error: "Partita non trovata, ricarica la pagina" };

  const home = !source.home;
  const [created] = await db
    .insert(matches)
    .values({
      seasonId: source.seasonId,
      phase: source.phase === "andata" ? "ritorno" : "andata",
      round: source.round,
      startsAt: null,
      home,
      opponentId: source.opponentId,
      venue: home ? HOME_VENUE : "",
    })
    .returning({ id: matches.id });

  revalidateMatches();
  return { ok: true, id: created.id };
}
