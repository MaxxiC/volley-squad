// Pila Annulla/Ripeti del Live salvata sul telefono (localStorage), per riprenderla dopo un
// ricaricamento della pagina. Legata al Live in corso (id della formazione del 1° set, come la
// copia del registro). Se lo storage non c'è o è pieno, il Live funziona lo stesso: dopo un
// ricaricamento la pila si ricostruisce dal registro (history.ts → restoreHistory).
import { trimHistory, type History } from "./history";

const PREFIX = "cusbros:undo:";
const keyOf = (matchId: number, start: number | null) => `${PREFIX}${matchId}:${start ?? 0}`;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Chiavi salvate (di una partita, o tutte). */
function keys(matchId?: number) {
  const s = storage();
  if (!s) return [];
  const prefix = matchId === undefined ? PREFIX : `${PREFIX}${matchId}:`;
  return Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => Boolean(k?.startsWith(prefix)));
}

export function loadUndo(matchId: number, start: number | null): History | null {
  const s = storage();
  if (!s) return null;
  // Pile di un Live precedente della stessa partita: non servono più.
  for (const k of keys(matchId)) if (k !== keyOf(matchId, start)) s.removeItem(k);
  try {
    const raw = s.getItem(keyOf(matchId, start));
    const h = raw ? (JSON.parse(raw) as History) : null;
    return h && Array.isArray(h.done) && Array.isArray(h.undone) ? h : null;
  } catch {
    return null;
  }
}

export function saveUndo(matchId: number, start: number | null, h: History) {
  try {
    storage()?.setItem(keyOf(matchId, start), JSON.stringify(trimHistory(h)));
  } catch {
    // Storage pieno o non disponibile: dopo un ricaricamento la pila si ricostruisce dal registro.
  }
}

/** Pile di una partita (o tutte): a fine partita, azzeramento, nuovo Live, uscita. */
export function clearUndo(matchId?: number) {
  const s = storage();
  for (const k of keys(matchId)) s?.removeItem(k);
}
