// Annulla / Ripeti del Live. Ogni operazione è "versione prima → versione dopo" di un evento:
// annullare rimette la versione prima (o marca annullato un evento appena aggiunto), ripetere
// rimette quella dopo. Una nuova operazione svuota "Ripeti".
import { activeEvents } from "./state";
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

/** Stesso evento, indipendentemente dall'ordine dei campi (dal server e da Postgres arrivano riordinati). */
function sameEvent(a: LiveEvent, b: LiveEvent) {
  const canon = (v: unknown): unknown =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, x]) => [k, canon(x)]))
      : Array.isArray(v) ? v.map(canon) : v;
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

/** Operazioni tenute nella pila salvata sul telefono (oltre, le più vecchie si perdono). */
export const MAX_SAVED_OPS = 300;

/** Pila da salvare: le ultime MAX_SAVED_OPS operazioni fatte e tutte quelle annullate. */
export function trimHistory(h: History): History {
  return { done: h.done.slice(-MAX_SAVED_OPS), undone: h.undone.slice(-MAX_SAVED_OPS) };
}

/**
 * Pila ricostruita dal registro quando quella salvata manca o non torna: ogni azione valida,
 * in ordine, come se fosse appena stata aggiunta. "Annulla" toglie l'ultima, poi la precedente.
 */
export function historyFromLog(events: Iterable<LiveEvent>): History {
  return { done: activeEvents(events).map((e) => ({ before: null, after: e })), undone: [] };
}

/**
 * Pila salvata sul telefono, se è ancora quella del registro attuale: l'ultima operazione fatta
 * deve corrispondere alla versione attuale del suo evento, e lo stesso l'ultima annullata (dopo
 * l'annullamento), e non devono esserci azioni più recenti che la pila non conosce. Altrimenti
 * (azioni fatte altrove, copia vecchia) si ricostruisce dal registro.
 */
export function restoreHistory(saved: History | null, current: Map<string, LiveEvent>): History {
  const ok = (version: LiveEvent | undefined, expected: LiveEvent) => Boolean(version && sameEvent(version, expected));
  if (saved && saved.done.length + saved.undone.length > 0) {
    const top = saved.done.at(-1);
    const topUndone = saved.undone.at(-1);
    const doneOk = !top || ok(current.get(top.after.id), top.after);
    const undoneOk = !topUndone || ok(current.get(topUndone.after.id), topUndone.before ?? { ...topUndone.after, deleted: true });
    const ops = [...saved.done, ...saved.undone];
    const known = ops.every((op) => current.has(op.after.id));
    // Un'azione più recente di quelle della pila che la pila non conosce: fatta altrove.
    const ids = new Set(ops.map((op) => op.after.id));
    const from = Math.min(...ops.map((op) => op.after.seq));
    const foreign = activeEvents(current.values()).some((e) => e.seq > from && !ids.has(e.id));
    if (doneOk && undoneOk && known && !foreign) return saved;
  }
  return historyFromLog(current.values());
}
