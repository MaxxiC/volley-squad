// Utilità comuni alle server action dell'area staff.
import { revalidatePath } from "next/cache";
import type { z } from "zod";

/** Esito di una server action: i dati in caso di successo, un messaggio leggibile altrimenti. */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Primo errore di validazione, già in italiano dagli schemi zod. */
export function invalid(error: z.ZodError): { ok: false; error: string } {
  return { ok: false, error: error.issues[0]?.message ?? "Dati non validi" };
}

/** Le pagine pubbliche che mostrano calendario, risultati, classifica e riepiloghi delle partite. */
export function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/calendario");
  revalidatePath("/partite/[id]", "page");
}
