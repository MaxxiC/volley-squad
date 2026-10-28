// Unione del registro del server con la copia locale del telefono (offline).
// La pagina può arrivare dalla cache del service worker, quindi con eventi più vecchi di quelli
// che il telefono ha già visto: la copia locale li completa.
import type { LiveEvent } from "./types";

export type LocalEntry = { event: LiveEvent; pending: boolean };

/**
 * Per ogni evento: la versione locale ancora da inviare vince sempre (è l'ultima azione fatta sul
 * telefono); altrimenti vale quella del server; un evento già inviato che il server non riporta
 * (pagina in cache più vecchia) si tiene dalla copia locale.
 */
export function mergeLogs(server: LiveEvent[], local: LocalEntry[]) {
  const events = new Map(server.map((e) => [e.id, e]));
  const toSend: LiveEvent[] = [];
  for (const { event, pending } of local) {
    if (pending) {
      events.set(event.id, event);
      toSend.push(event);
    } else if (!events.has(event.id)) {
      events.set(event.id, event);
    }
  }
  return { events, toSend };
}

/** Stessa versione di un evento (per togliere dalla coda solo ciò che il server ha davvero ricevuto). */
export function sameVersion(a: LiveEvent, b: LiveEvent) {
  return JSON.stringify(a) === JSON.stringify(b);
}
