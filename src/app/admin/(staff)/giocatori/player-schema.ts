// Validazione del form giocatore (solo server: importata dalle action).
import { z } from "zod";
import { PLAYER_ROLES } from "@/lib/players";
import type { PlayerFormInput } from "./player-form";

export const PlayerFormSchema = z.object({
  id: z.number().int().positive().optional(),
  number: z.string().trim().regex(/^\d{1,2}$/, "Numero di maglia: da 0 a 99").transform(Number),
  firstName: z.string().trim().min(1, "Inserisci il nome").max(40, "Nome troppo lungo"),
  lastName: z.string().trim().max(40, "Cognome troppo lungo"),
  role: z.enum(PLAYER_ROLES, "Scegli il ruolo"),
  active: z.boolean(),
}) satisfies z.ZodType<unknown, PlayerFormInput>;
