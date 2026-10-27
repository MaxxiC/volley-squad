"use server";

import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { standings } from "@/db/schema";
import { requireStaff } from "@/lib/auth-guard";
import { getCurrentSeason } from "@/lib/data";
import { findOrCreateTeam } from "@/lib/teams";
import { StandingsSchema, type StandingsInput } from "./standings-form";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Sostituisce l'intera classifica della stagione corrente. */
export async function saveStandings(input: StandingsInput): Promise<SaveResult> {
  await requireStaff();
  const parsed = StandingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const season = await getCurrentSeason();
  const rows = [];
  for (const { team: name, ...stats } of parsed.data) {
    const team = await findOrCreateTeam(name);
    // Nella pallavolo non ci sono pareggi: giocate = vinte + perse.
    rows.push({ seasonId: season.id, teamId: team.id, ...stats, played: stats.won + stats.lost });
  }

  // Cancella e riscrive in un'unica transazione.
  const queries: BatchItem<"pg">[] = [db.delete(standings).where(eq(standings.seasonId, season.id))];
  if (rows.length) queries.push(db.insert(standings).values(rows));
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  revalidatePath("/");
  revalidatePath("/calendario");
  revalidatePath("/admin/partite/classifica");
  return { ok: true };
}
