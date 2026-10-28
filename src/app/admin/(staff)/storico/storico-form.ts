// Tipi delle azioni dello Storico usati dal client. La validazione (zod) è in storico-schema.ts.
import type { ActionEdit } from "@/lib/live/storico";

export type SaveEventInput = { matchId: number; eventId: string; edit: ActionEdit };
export type DeleteEventInput = { matchId: number; eventId: string };
/** Nuova azione nel set: dopo `afterId` o, se null, in fondo al set. */
export type AddEventInput = { matchId: number; setN: number; afterId: string | null; edit: ActionEdit };
