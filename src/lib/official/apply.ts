// Import dal sito ufficiale: scrittura nel DB del piano calcolato da diff.ts (usata da "Applica"
// in Admin → Partite → Ufficiale). Le partite registrate col Live restano come sono (diff.ts).
import { eq } from "drizzle-orm";
import { db, runBatch } from "@/db";
import { matchSets, matches, standings, teams } from "@/db/schema";
import type { OfficialPlan, TeamRef } from "./diff";

/** Squadre nuove, collegamenti, nostre partite e classifica; la classifica si riscrive in blocco. */
export async function applyOfficialPlan(plan: OfficialPlan, seasonId: number) {
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
      .values({ ...values, seasonId: seasonId, opponentId: teamId(opponent), status: c.result ? "finished" : "scheduled" })
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
    writes.push(db.delete(standings).where(eq(standings.seasonId, seasonId)));
    writes.push(db.insert(standings).values(plan.standings.map(({ team, ...s }) => ({ ...s, seasonId: seasonId, teamId: teamId(team) }))));
  }
  if (writes.length) await runBatch(writes);

}
