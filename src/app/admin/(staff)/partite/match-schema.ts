// Validazione del form partita (solo server: importata dalle action).
import { z } from "zod";
import { matchScore } from "@/lib/matches";
import { SET_SLOTS, type MatchFormInput, type SetSlot } from "./match-form";

const score = (s: string) => (/^\d{1,2}$/.test(s) ? Number(s) : null);

export const MatchFormSchema = z
  .object({
    id: z.number().int().positive().optional(),
    phase: z.enum(["andata", "ritorno"]),
    round: z.string().trim().regex(/^[1-9]\d?$/, "Inserisci la giornata (1–99)").transform(Number),
    number: z
      .string()
      .trim()
      .regex(/^\d{0,4}$/, "Numero gara non valido")
      .transform((s) => (s ? Number(s) : null)),
    date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")]),
    time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, "Ora non valida")]),
    home: z.boolean(),
    opponent: z.string().trim().min(1, "Inserisci l'avversario").max(80, "Nome avversario troppo lungo"),
    venue: z.string().trim().max(120, "Nome palestra troppo lungo"),
    slots: z.array(z.object({ us: z.string().trim(), them: z.string().trim() })).length(SET_SLOTS),
  })
  .transform(({ slots, ...f }, ctx) => {
    if (f.date && !f.time) {
      ctx.addIssue({ code: "custom", message: "Inserisci l'ora della partita" });
      return z.NEVER;
    }
    const parsed = parseSets(slots);
    if ("error" in parsed) {
      ctx.addIssue({ code: "custom", message: parsed.error });
      return z.NEVER;
    }
    return { ...f, sets: parsed.sets };
  }) satisfies z.ZodType<unknown, MatchFormInput>;

/** Parziali: set compilati in ordine, senza buchi né pareggi, nessun set dopo la fine della partita. */
function parseSets(slots: SetSlot[]): { sets: { us: number; them: number }[] } | { error: string } {
  const sets: { us: number; them: number }[] = [];
  let gap = false;
  for (const [i, slot] of slots.entries()) {
    const n = i + 1;
    if (!slot.us && !slot.them) {
      gap = true;
      continue;
    }
    const us = score(slot.us);
    const them = score(slot.them);
    const sofar = matchScore(sets);
    if (us === null || them === null) return { error: `Set ${n}: inserisci entrambi i punteggi (0–99)` };
    if (gap) return { error: `Set ${n}: compila i set in ordine, senza saltarne` };
    if (us === them) return { error: `Set ${n}: un set non può finire in parità` };
    if (sofar.over) return { error: `Set ${n}: la partita era già finita ${sofar.us}–${sofar.them}` };
    sets.push({ us, them });
  }
  return { sets };
}
