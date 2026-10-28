// Copia locale del registro del Live su IndexedDB (solo nel browser): ogni azione si salva qui
// subito, con `pending` finché il server non conferma. Chiudendo l'app senza rete non si perde nulla;
// alla riapertura la coda riparte. Se IndexedDB non è disponibile (es. navigazione privata) le
// funzioni non falliscono: il Live continua a funzionare solo in memoria.
import { sameVersion, type LocalEntry } from "./merge";
import type { LiveEvent } from "./types";

const DB_NAME = "cusbros-live";
const STORE = "events";

/** start = Live a cui appartiene la riga (id della formazione del 1° set, vedi loadLiveLog). */
type Row = LocalEntry & { id: string; matchId: number; start?: number | null };

let opening: Promise<IDBDatabase> | null = null;

function openDb() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("matchId", "matchId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    opening = null;
    throw err;
  });
  return opening;
}

/** Esegue `run` in una transazione e attende che sia scritta su disco. */
async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => T | Promise<T>): Promise<T> {
  const db = await openDb();
  const t = db.transaction(STORE, mode);
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  const result = await run(t.objectStore(STORE));
  await done;
  return result;
}

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Copia locale di questo Live; le righe di un Live precedente della stessa partita si cancellano. */
export async function loadLocalLog(matchId: number, start: number | null): Promise<LocalEntry[]> {
  try {
    const rows = await tx("readwrite", async (s) => {
      const all = (await request(s.index("matchId").getAll(matchId))) as Row[];
      for (const r of all) if (r.start !== start) s.delete(r.id);
      return all.filter((r) => r.start === start);
    });
    return rows.map(({ event, pending }) => ({ event, pending }));
  } catch {
    return [];
  }
}

/** Salva una versione di un evento come "da inviare". */
export async function saveLocal(matchId: number, start: number | null, event: LiveEvent) {
  try {
    await tx("readwrite", (s) => void s.put({ id: event.id, matchId, start, event, pending: true } satisfies Row));
  } catch {
    // Solo in memoria.
  }
}

/** Il server ha ricevuto queste versioni: non sono più da inviare (se nel frattempo non sono cambiate). */
export async function markSynced(events: LiveEvent[]) {
  try {
    await tx("readwrite", async (s) => {
      for (const e of events) {
        const row = (await request(s.get(e.id))) as Row | undefined;
        if (row?.pending && sameVersion(row.event, e)) s.put({ ...row, pending: false });
      }
    });
  } catch {
    // Alla prossima apertura si reinviano: l'API è idempotente.
  }
}

/** Azioni di qualsiasi partita non ancora arrivate al server. */
export async function pendingCount() {
  try {
    const rows = await tx("readonly", (s) => request(s.getAll() as IDBRequest<Row[]>));
    return rows.filter((r) => r.pending).length;
  } catch {
    return 0;
  }
}

/** Uscita dall'area staff: copia locale cancellata, ma solo se non c'è nulla da inviare. */
export async function clearIfSynced() {
  const pending = await pendingCount();
  if (pending > 0) return pending;
  try {
    await tx("readwrite", (s) => void s.clear());
  } catch {
    // Nulla da pulire.
  }
  return 0;
}

/** Partita conclusa: la copia locale non serve più. */
export async function clearLocalLog(matchId: number) {
  try {
    await tx("readwrite", async (s) => {
      const keys = await request(s.index("matchId").getAllKeys(matchId));
      for (const k of keys) s.delete(k);
    });
  } catch {
    // Nulla da pulire.
  }
}
