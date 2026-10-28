// Validazione di "Inizia partita" (solo server: importata dalla action).
import { z } from "zod";
import { PLAYER_ROLES } from "@/lib/players";
import type { StartMatchInput } from "./prepare-form";

const id = z.number().int().positive();

export const StartMatchSchema = z
  .object({
    matchId: id,
    present: z.array(z.object({ playerId: id, role: z.enum(PLAYER_ROLES) })).min(6, "Servono almeno 6 presenti"),
    slots: z.array(id).length(6, "Completa la formazione: servono 6 giocatori in campo"),
    liberoId: id.nullable(),
    serveFirst: z.enum(["us", "them"], "Scegli chi batte per primo"),
  })
  .superRefine((f, ctx) => {
    const present = new Set(f.present.map((p) => p.playerId));
    if (present.size !== f.present.length) ctx.addIssue({ code: "custom", message: "Un giocatore compare due volte tra i presenti" });
    if (new Set(f.slots).size !== 6) ctx.addIssue({ code: "custom", message: "In campo c'è due volte lo stesso giocatore" });
    if (f.slots.some((p) => !present.has(p))) ctx.addIssue({ code: "custom", message: "In formazione c'è un giocatore non presente" });
    if (f.liberoId !== null && !present.has(f.liberoId)) ctx.addIssue({ code: "custom", message: "Il libero deve essere tra i presenti" });
    if (f.liberoId !== null && f.slots.includes(f.liberoId)) {
      ctx.addIssue({ code: "custom", message: "Il libero non può essere anche in formazione" });
    }
  }) satisfies z.ZodType<unknown, StartMatchInput>;
