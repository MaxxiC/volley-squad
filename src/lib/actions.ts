// Utilità comuni alle server action dell'area staff.
import { revalidatePath } from "next/cache";
import type { z } from "zod";

/** Esito di una server action: i dati in caso di successo, un messaggio leggibile altrimenti. */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Primo errore di validazione, già in italiano dagli schemi zod. */
export function invalid(error: z.ZodError): { ok: false; error: string } {
  return { ok: false, error: error.issues[0]?.message ?? "Dati non validi" };
}

/**
 * Le pagine pubbliche (home, calendario, riepiloghi delle partite, statistiche e schede): si aggiorna
 * tutto il sito dal layout radice. Le pagine con [id] in cache (generate alla prima visita) non si
 * aggiornano con revalidatePath("/statistiche/[id]", "page"), verificato sulla build di produzione;
 * le pagine dello staff sono comunque sempre ricalcolate, quindi non costa nulla in più.
 */
export function revalidatePublicPages() {
  revalidatePath("/", "layout");
}
