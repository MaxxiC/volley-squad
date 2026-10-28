"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, runBatch } from "@/db";
import { matchSets, matches, standings, teams } from "@/db/schema";
import { revalidatePublicPages, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/lib/auth-guard";
import { getCurrentSeason } from "@/lib/data";
import { planIsEmpty, type OfficialPlan, type TeamRef } from "@/lib/official/diff";
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

  // Squadre nuove per prime: servono i loro id.
  const created = new Map<number, number>();
  for (const t of plan.createTeams) {
    const [row] = await db.insert(teams).values({ name: t.name, officialId: t.officialId }).returning({ id: teams.id });
    created.set(t.officialId, row.id);
  }
  const teamId = (ref: TeamRef) => ("teamId" in ref ? ref.teamId : created.get(ref.create)!);

  // Partite nuove: inserite una per una (servono gli id per i parziali).
  for (const c of plan.creates) {
    const { opponent, ...values } = c.values;
    const [row] = await db
      .insert(matches)
      .values({ ...values, seasonId: season.id, opponentId: teamId(opponent), status: c.result ? "finished" : "scheduled" })
      .returning({ id: matches.id });
    if (c.result) await db.insert(matchSets).values(c.result.map((s, i) => ({ matchId: row.id, n: i + 1, ...s })));
  }

  const writes: Parameters<typeof runBatch>[0] = [];
  for (const l of plan.linkTeams) writes.push(db.update(teams).set({ officialId: l.officialId }).where(eq(teams.id, l.teamId)));
  for (const u of plan.updates) {
    const { opponent, ...values } = u.values;
    const set = {
      ...values,
      ...(opponent ? { opponentId: teamId(opponent) } : {}),
      ...(u.result ? { status: "finished" as const, forfeit: false } : u.reschedule ? { status: "scheduled" as const } : {}),
    };
    if (Object.keys(set).length) writes.push(db.update(matches).set(set).where(eq(matches.id, u.matchId)));
    if (u.result) {
      writes.push(db.delete(matchSets).where(eq(matchSets.matchId, u.matchId)));
      writes.push(db.insert(matchSets).values(u.result.map((s, i) => ({ matchId: u.matchId, n: i + 1, ...s }))));
    }
  }
  if (plan.standingsChanges.length) {
    writes.push(db.delete(standings).where(eq(standings.seasonId, season.id)));
    writes.push(db.insert(standings).values(plan.standings.map(({ team, ...s }) => ({ ...s, seasonId: season.id, teamId: teamId(team) }))));
  }
  if (writes.length) await runBatch(writes);

  revalidatePublicPages();
  revalidatePath("/admin/partite");
  revalidatePath("/admin/partite/classifica");
  revalidatePath("/admin/partite/ufficiale");
  return { ok: true, summary: summarize(plan) };
}
