// Tipi e validazione del form partita, condivisi tra client (editor) e server (actions).
import { z } from "zod";

/** Partita come la vede l'editor: date e ore già nel formato degli input, ora italiana. */
export type AdminMatch = {
  id: number;
  phase: "andata" | "ritorno";
  round: number;
  number: number | null;
  date: string;
  time: string;
  home: boolean;
  opponent: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  sets: { us: number; them: number }[];
};

export type SetSlot = { us: string; them: string };

export const SET_SLOTS = 5;

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
  .transform((f, ctx) => {
    if (f.date && !f.time) {
      ctx.addIssue({ code: "custom", message: "Inserisci l'ora della partita" });
      return z.NEVER;
    }

    // Parziali: set compilati in ordine, senza buchi né pareggi, stop a 3 set vinti.
    const sets: { us: number; them: number }[] = [];
    let ended = false;
    for (const [i, slot] of f.slots.entries()) {
      const n = i + 1;
      if (!slot.us && !slot.them) {
        ended = true;
        continue;
      }
      const us = score(slot.us);
      const them = score(slot.them);
      const won = sets.filter((s) => s.us > s.them).length;
      const lost = sets.length - won;
      let error: string | null = null;
      if (us === null || them === null) error = `Set ${n}: inserisci entrambi i punteggi (0–99)`;
      else if (ended) error = `Set ${n}: compila i set in ordine, senza saltarne`;
      else if (us === them) error = `Set ${n}: un set non può finire in parità`;
      else if (won === 3 || lost === 3) error = `Set ${n}: la partita era già finita 3 set a ${Math.min(won, lost)}`;
      if (error || us === null || them === null) {
        ctx.addIssue({ code: "custom", message: error ?? "" });
        return z.NEVER;
      }
      sets.push({ us, them });
    }

    return {
      id: f.id,
      phase: f.phase,
      round: f.round,
      number: f.number,
      date: f.date,
      time: f.time,
      home: f.home,
      opponent: f.opponent,
      venue: f.venue,
      sets,
    };
  });

export type MatchFormInput = z.input<typeof MatchFormSchema>;
