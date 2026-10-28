// Annulla / Ripeti del Live. Ogni operazione è "versione prima → versione dopo" di un evento:
// annullare rimette la versione prima (o marca annullato un evento appena aggiunto), ripetere
// rimette quella dopo. Una nuova operazione svuota "Ripeti".
import type { LiveEvent } from "./types";

export type Op = { before: LiveEvent | null; after: LiveEvent };
export type History = { done: Op[]; undone: Op[] };

export const EMPTY_HISTORY: History = { done: [], undone: [] };

export function record(h: History, op: Op): History {
  return { done: [...h.done, op], undone: [] };
}

/** Restituisce la nuova storia e la versione dell'evento da applicare (null se non c'è nulla). */
export function undo(h: History): { history: History; apply: LiveEvent } | null {
  const op = h.done.at(-1);
  if (!op) return null;
  return {
    history: { done: h.done.slice(0, -1), undone: [...h.undone, op] },
    apply: op.before ?? { ...op.after, deleted: true },
  };
}

export function redo(h: History): { history: History; apply: LiveEvent } | null {
  const op = h.undone.at(-1);
  if (!op) return null;
  return { history: { done: [...h.done, op], undone: h.undone.slice(0, -1) }, apply: op.after };
}
