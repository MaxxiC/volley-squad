// Tipi e validazione della classifica modificabile (client + server).
import { z } from "zod";

/** Riga come la vede l'editor: numeri come stringhe degli input. */
export type StandingDraft = {
  key: string;
  team: string;
  points: string;
  won: string;
  lost: string;
  setsWon: string;
  setsLost: string;
};

export const STAT_FIELDS = [
  { key: "points", label: "Pt" },
  { key: "won", label: "V" },
  { key: "lost", label: "P" },
  { key: "setsWon", label: "SV" },
  { key: "setsLost", label: "SP" },
] as const;

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
  });

export type StandingsInput = z.input<typeof StandingsSchema>;
