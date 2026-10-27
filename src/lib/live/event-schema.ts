// Validazione degli eventi inviati dal Live (solo server: importata dalla route API).
import { z } from "zod";
import { PLAYER_ROLES } from "../players";
import { SKILLS } from "./skills";

const side = z.enum(["us", "them"]);

export const LiveEventSchema = z.object({
  id: z.uuid(),
  setN: z.number().int().min(1).max(5),
  seq: z.number().int().min(0),
  createdAt: z.iso.datetime({ offset: true }),
  kind: z.enum(["action", "sub", "rotation", "set_end"]),
  playerId: z.number().int().positive().nullable(),
  skill: z.enum([...SKILLS, "opp_error", "opp_point"]).nullable(),
  outcome: z.string().max(20).nullable(),
  point: side.nullable(),
  star: z.boolean(),
  incomplete: z.boolean(),
  deleted: z.boolean(),
  detail: z
    .object({
      ballType: z.enum(["free", "rally"]).optional(),
      dir: z.union([z.literal(1), z.literal(-1)]).optional(),
      // Cambi (passo 4.3): chi entra, chi esce e in che ruolo.
      in: z.number().int().positive().optional(),
      out: z.number().int().positive().optional(),
      role: z.enum(PLAYER_ROLES).optional(),
    })
    .strict()
    .nullable(),
});

export const EventBatchSchema = z.object({ events: z.array(LiveEventSchema).min(1).max(500) });
