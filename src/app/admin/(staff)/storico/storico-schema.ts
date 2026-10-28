// Validazione delle azioni dello Storico (solo server: importata dalle action).
import { z } from "zod";
import { EDIT_SKILLS } from "@/lib/live/storico";
import type { AddEventInput, DeleteEventInput, SaveEventInput } from "./storico-form";

const id = z.number().int().positive();

const ActionEditSchema = z.object({
  skill: z.enum(EDIT_SKILLS).nullable(),
  outcome: z.string().max(20).nullable(),
  playerId: id.nullable(),
  star: z.boolean(),
});

export const SaveEventSchema = z.object({ matchId: id, eventId: z.uuid(), edit: ActionEditSchema }) satisfies z.ZodType<unknown, SaveEventInput>;

export const DeleteEventSchema = z.object({ matchId: id, eventId: z.uuid() }) satisfies z.ZodType<unknown, DeleteEventInput>;

export const AddEventSchema = z.object({
  matchId: id,
  setN: z.number().int().min(1).max(5),
  afterId: z.uuid().nullable(),
  edit: ActionEditSchema,
}) satisfies z.ZodType<unknown, AddEventInput>;
