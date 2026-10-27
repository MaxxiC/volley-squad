// Validazione della classifica (solo server: importata dalla action).
import { z } from "zod";
import type { StandingsInput } from "./standings-form";

const stat = (label: string) =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" ? "0" : s))
    .pipe(z.string().regex(/^\d{1,3}$/, `${label}: inserisci un numero da 0 a 999`))
    .transform(Number);

export const StandingsSchema = z
  .array(
    z.object({
      team: z.string().trim().min(1, "Ogni riga deve avere il nome della squadra").max(80, "Nome squadra troppo lungo"),
      points: stat("Punti"),
      won: stat("Vinte"),
      lost: stat("Perse"),
      setsWon: stat("Set vinti"),
      setsLost: stat("Set persi"),
    }),
  )
  .max(30, "Massimo 30 squadre")
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    for (const r of rows) {
      const k = r.team.toLowerCase();
      if (seen.has(k)) ctx.addIssue({ code: "custom", message: `${r.team} compare due volte` });
      seen.add(k);
    }
  }) satisfies z.ZodType<unknown, StandingsInput>;
