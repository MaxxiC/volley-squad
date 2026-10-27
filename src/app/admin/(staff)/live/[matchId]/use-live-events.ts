"use client";

// Registro eventi del Live sul client: aggiunta/modifica, Annulla/Ripeti e coda di invio al server.
// Ogni cambiamento produce la versione completa di un evento, che va in coda e viene salvata per id
// (upsert idempotente): reinviare non crea doppioni.
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_HISTORY, record, redo as redoOp, undo as undoOp, type History } from "@/lib/live/history";
import type { LiveEvent } from "@/lib/live/types";
import { uuid } from "@/lib/uuid";

export type SyncStatus = { pending: number; error: string | null };

const RETRY_MS = 4000;
const FLUSH_DELAY_MS = 250;

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
  const [sync, setSync] = useState<SyncStatus>({ pending: 0, error: null });

  const flush = useCallback(async () => {
    if (inFlight.current || queue.current.size === 0) return;
    inFlight.current = true;
    const batch = [...queue.current.values()];
    try {
      const res = await fetch(`/api/matches/${matchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Errore ${res.status}`);
      }
      // Tolgo dalla coda solo le versioni inviate: se nel frattempo un evento è cambiato, resta in coda.
      for (const e of batch) if (queue.current.get(e.id) === e) queue.current.delete(e.id);
      setSync({ pending: queue.current.size, error: null });
    } catch (err) {
      setSync({ pending: queue.current.size, error: err instanceof Error ? err.message : "Rete non disponibile" });
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

  // Appena torna la rete si riprova subito.
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const apply = useCallback(
    (version: LiveEvent) => {
      const next = new Map(eventsRef.current);
      next.set(version.id, version);
      eventsRef.current = next;
      setEvents(next);
      queue.current.set(version.id, version);
      setSync((s) => ({ ...s, pending: queue.current.size }));
      scheduleFlush();
    },
    [scheduleFlush],
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
