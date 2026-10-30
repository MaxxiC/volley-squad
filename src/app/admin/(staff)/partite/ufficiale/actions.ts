"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicPages, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/lib/auth-guard";
import { getCurrentSeason } from "@/lib/data";
import { applyOfficialPlan } from "@/lib/official/apply";
import { planIsEmpty, type OfficialPlan } from "@/lib/official/diff";
import { officialPlan } from "@/lib/official/load";
import type { OfficialSummary } from "./ufficiale-form";

/** Riepilogo leggibile del piano (quello che la pagina mostra prima di "Applica"). */
function summarize(p: OfficialPlan): OfficialSummary {
  return {
    createTeams: p.createTeams.map((t) => t.name),
    linkTeams: p.linkTeams.length,
    updates: p.updates.map((u) => ({ label: u.label, changes: u.changes })),
    creates: p.creates.map((c) => c.label),
    warnings: p.warnings,
    standings: p.standingsChanges,
    empty: planIsEmpty(p),
  };
}

const failure = (err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "Lettura del sito ufficiale non riuscita" });

/** Legge il sito ufficiale e dice cosa cambierebbe (nessuna scrittura). */
export async function checkOfficial(): Promise<ActionResult<{ summary: OfficialSummary }>> {
  await requireStaff();
  try {
    const season = await getCurrentSeason();
    return { ok: true, summary: summarize(await officialPlan(season.id)) };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Rilegge il sito (il piano si ricalcola qui: non ci si fida di quello mostrato) e applica tutto:
 * squadre nuove, collegamenti, nostre partite, classifica. Le partite registrate col Live
 * restano come sono (diff.ts).
 */
export async function applyOfficial(): Promise<ActionResult<{ summary: OfficialSummary }>> {
  await requireStaff();
  let plan: OfficialPlan;
  const season = await getCurrentSeason();
  try {
    plan = await officialPlan(season.id);
  } catch (err) {
    return failure(err);
  }
  if (planIsEmpty(plan)) return { ok: true, summary: summarize(plan) };

  await applyOfficialPlan(plan, season.id);

  revalidatePublicPages();
  revalidatePath("/admin/partite");
  revalidatePath("/admin/partite/classifica");
  revalidatePath("/admin/partite/ufficiale");
  return { ok: true, summary: summarize(plan) };
}
