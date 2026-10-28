"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, runBatch } from "@/db";
import { standings } from "@/db/schema";
import { invalid, revalidatePublicPages, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/lib/auth-guard";
import { getCurrentSeason } from "@/lib/data";
import { findOrCreateTeam } from "@/lib/teams";
import type { StandingsInput } from "./standings-form";
import { StandingsSchema } from "./standings-schema";

/** Sostituisce l'intera classifica della stagione corrente. */
export async function saveStandings(input: StandingsInput): Promise<ActionResult> {
  await requireStaff();
  const parsed = StandingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const season = await getCurrentSeason();
  const rows = [];
  for (const { team: name, ...stats } of parsed.data) {
    const team = await findOrCreateTeam(name);
    // Nella pallavolo non ci sono pareggi: giocate = vinte + perse.
    rows.push({ seasonId: season.id, teamId: team.id, ...stats, played: stats.won + stats.lost });
  }

  // Cancella e riscrive in un'unica transazione.
  await runBatch([
    db.delete(standings).where(eq(standings.seasonId, season.id)),
    ...(rows.length ? [db.insert(standings).values(rows)] : []),
  ]);

  revalidatePublicPages();
  revalidatePath("/admin/partite/classifica");
  return { ok: true };
}
