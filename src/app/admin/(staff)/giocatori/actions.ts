"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { isForeignKeyViolation } from "@/db/errors";
import { players } from "@/db/schema";
import { invalid, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/lib/auth-guard";
import { fullName } from "@/lib/players";
import type { PlayerFormInput } from "./player-form";
import { PlayerFormSchema } from "./player-schema";

type PlayerResult = ActionResult<{ id: number }>;

const NOT_FOUND = { ok: false, error: "Giocatore non trovato, ricarica la pagina" } as const;

export async function savePlayer(input: PlayerFormInput): Promise<PlayerResult> {
  await requireStaff();
  const parsed = PlayerFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...fields } = parsed.data;

  // Due giocatori attivi con lo stesso numero confonderebbero il Live.
  if (fields.active) {
    const clash = await db.query.players.findFirst({
      where: and(eq(players.number, fields.number), eq(players.active, true), id ? ne(players.id, id) : undefined),
    });
    if (clash) return { ok: false, error: `Il numero ${fields.number} è già di ${fullName(clash)}` };
  }

  let playerId: number;
  if (id) {
    const updated = await db.update(players).set(fields).where(eq(players.id, id)).returning({ id: players.id });
    if (!updated.length) return NOT_FOUND;
    playerId = id;
  } else {
    const [created] = await db.insert(players).values(fields).returning({ id: players.id });
    playerId = created.id;
  }

  revalidatePath("/admin/giocatori");
  return { ok: true, id: playerId };
}

/** Elimina solo chi non ha dati di partita; altrimenti va disattivato per non perdere le statistiche. */
export async function deletePlayer(id: number): Promise<PlayerResult> {
  await requireStaff();
  try {
    const deleted = await db.delete(players).where(eq(players.id, id)).returning({ id: players.id });
    if (!deleted.length) return NOT_FOUND;
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return { ok: false, error: "Ha già presenze o azioni registrate: disattivalo invece di eliminarlo." };
    }
    throw err;
  }
  revalidatePath("/admin/giocatori");
  return { ok: true, id };
}
