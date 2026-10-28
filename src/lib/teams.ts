import { sql } from "drizzle-orm";
import { db } from "@/db";
import { teams } from "@/db/schema";

/** Squadra per nome (senza distinguere maiuscole); la crea se non esiste. */
export async function findOrCreateTeam(name: string) {
  const find = () => db.query.teams.findFirst({ where: sql`lower(${teams.name}) = lower(${name})` });
  const existing = await find();
  if (existing) return existing;
  await db.insert(teams).values({ name }).onConflictDoNothing();
  const created = await find();
  if (!created) throw new Error(`Impossibile creare la squadra ${name}`);
  return created;
}
