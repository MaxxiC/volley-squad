"use client";

// Registro eventi del Live sul client: aggiunta/modifica, Annulla/Ripeti e coda di invio al server.
// Ogni cambiamento produce la versione completa di un evento, che si salva subito sul telefono
// (IndexedDB, sopravvive alla chiusura dell'app) e va in coda per il server, dove si salva per id
// (upsert idempotente): reinviare non crea doppioni.
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_HISTORY, record, redo as redoOp, undo as undoOp, type History } from "@/lib/live/history";
import { loadLocalLog, markSynced, saveLocal } from "@/lib/live/local-log";
import { mergeLogs } from "@/lib/live/merge";
import type { LiveEvent } from "@/lib/live/types";
import { uuid } from "@/lib/uuid";

/** offline = rete assente (le azioni restano in coda); error = il server ha risposto con un errore. */
export type SyncStatus = { pending: number; offline: boolean; error: string | null };

const RETRY_MS = 4000;
const FLUSH_DELAY_MS = 250;

class ServerError extends Error {}

export function useLiveEvents(matchId: number, initial: LiveEvent[]) {
  // Il ref è la fonte di verità (letture sempre aggiornate anche tra due tocchi rapidi);
  // lo state serve solo a ridisegnare.
  const eventsRef = useRef(new Map(initial.map((e) => [e.id, e])));
  const [events, setEvents] = useState(eventsRef.current);
  const historyRef = useRef<History>(EMPTY_HISTORY);
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);

  const queue = useRef(new Map<string, LiveEvent>());
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ pending: 0, offline: false, error: null });

  const flush = useCallback(async () => {
    if (inFlight.current || queue.current.size === 0) return;
    inFlight.current = true;
    const batch = [...queue.current.values()];
    try {
      const res = await fetch(`/api/matches/${matchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
      }).catch(() => null);
      if (!res) throw new Error("offline");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new ServerError(body?.error ?? `Errore ${res.status}`);
      }
      // Tolgo dalla coda solo le versioni inviate: se nel frattempo un evento è cambiato, resta in coda.
      for (const e of batch) if (queue.current.get(e.id) === e) queue.current.delete(e.id);
      void markSynced(batch);
      setSync({ pending: queue.current.size, offline: false, error: null });
    } catch (err) {
      const offline = !(err instanceof ServerError);
      setSync({ pending: queue.current.size, offline, error: offline ? null : (err as Error).message });
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, RETRY_MS);
    } finally {
      inFlight.current = false;
    }
    if (queue.current.size > 0 && !timer.current) void flush();
  }, [matchId]);

  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flush();
    }, FLUSH_DELAY_MS);
  }, [flush]);

  // All'apertura: copia locale + registro del server; ciò che non era arrivato al server riparte.
  useEffect(() => {
    let cancelled = false;
    void loadLocalLog(matchId).then((local) => {
      if (cancelled || local.length === 0) return;
      const { events: merged, toSend } = mergeLogs([...eventsRef.current.values()], local);
      // Azioni fatte nel frattempo (già in coda) hanno la precedenza.
      for (const e of queue.current.values()) merged.set(e.id, e);
      eventsRef.current = merged;
      setEvents(merged);
      for (const e of toSend) if (!queue.current.has(e.id)) queue.current.set(e.id, e);
      setSync((s) => ({ ...s, pending: queue.current.size }));
      if (queue.current.size > 0) scheduleFlush();
    });
    return () => {
      cancelled = true;
    };
  }, [matchId, scheduleFlush]);

  // Appena torna la rete (o si torna sull'app) si riprova subito.
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState !== "visible") return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      void flush();
    };
    const onOffline = () => setSync((s) => ({ ...s, offline: true }));
    if (!navigator.onLine) onOffline();
    window.addEventListener("online", retry);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", retry);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const apply = useCallback(
    (version: LiveEvent) => {
      const next = new Map(eventsRef.current);
      next.set(version.id, version);
      eventsRef.current = next;
      setEvents(next);
      void saveLocal(matchId, version);
      queue.current.set(version.id, version);
      setSync((s) => ({ ...s, pending: queue.current.size }));
      scheduleFlush();
    },
    [matchId, scheduleFlush],
  );

  const setHistoryBoth = (h: History) => {
    historyRef.current = h;
    setHistory(h);
  };

  /** Nuovo evento in coda al registro; restituisce l'evento creato. */
  const add = useCallback(
    (fields: Partial<LiveEvent> & Pick<LiveEvent, "setN" | "kind">) => {
      const seq = Math.max(0, ...[...eventsRef.current.values()].map((e) => e.seq)) + 1;
      const event: LiveEvent = {
        id: uuid(),
        seq,
        createdAt: new Date().toISOString(),
        playerId: null,
        skill: null,
        outcome: null,
        point: null,
        star: false,
        incomplete: false,
        deleted: false,
        detail: null,
        ...fields,
      };
      apply(event);
      setHistoryBoth(record(historyRef.current, { before: null, after: event }));
      return event;
    },
    [apply],
  );

  /** Modifica un evento esistente (es. completare "come" e "chi" di un punto). */
  const update = useCallback(
    (id: string, patch: Partial<LiveEvent>) => {
      const before = eventsRef.current.get(id);
      if (!before) return;
      const after = { ...before, ...patch };
      apply(after);
      setHistoryBoth(record(historyRef.current, { before, after }));
    },
    [apply],
  );

  const undo = useCallback(() => {
    const res = undoOp(historyRef.current);
    if (!res) return;
    apply(res.apply);
    setHistoryBoth(res.history);
  }, [apply]);

  const redo = useCallback(() => {
    const res = redoOp(historyRef.current);
    if (!res) return;
    apply(res.apply);
    setHistoryBoth(res.history);
  }, [apply]);

  return {
    events,
    add,
    update,
    undo,
    redo,
    canUndo: history.done.length > 0,
    canRedo: history.undone.length > 0,
    sync,
  };
}
