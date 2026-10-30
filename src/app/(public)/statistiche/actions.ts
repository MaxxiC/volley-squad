"use server";

import { revalidatePublicPages, type ActionResult } from "@/lib/actions";
import { currentStaff } from "@/lib/auth-guard";

/**
 * "Aggiorna" delle statistiche: rigenera subito le pagine pubbliche invece di aspettare la cache
 * (5 minuti). Solo per lo staff: altrimenti chiunque potrebbe far ricalcolare tutto a ripetizione.
 */
export async function refreshPublicPages(): Promise<ActionResult> {
  if (!(await currentStaff())) return { ok: false, error: "Solo lo staff può aggiornare le pagine" };
  revalidatePublicPages();
  return { ok: true };
}
