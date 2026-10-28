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

/**
 * problem: offline = rete assente · auth = sessione scaduta (serve rientrare) · error = il server non
 * risponde bene (si riprova). rejected = azioni scartate dal server perché non valide: restano solo
 * sul telefono e non bloccano le altre.
 */
export type SyncStatus = {
  /** Copia locale del telefono non ancora letta: lo stato di invio non è ancora affidabile. */
  restoring: boolean;
  pending: number;
  problem: "offline" | "auth" | "error" | null;
  message: string | null;
  rejected: { count: number; message: string | null };
};

const RETRY_MS = 4000;
const FLUSH_DELAY_MS = 250;
/** Eventi per richiesta (l'API ne accetta al massimo 500): una partita intera offline va a blocchi. */
const BATCH_SIZE = 100;

type Problem = { kind: "auth" | "error"; message: string } | { kind: "offline" };
type PostResult = { kind: "ok" } | { kind: "rejected"; message: string } | Problem;

/** Quante azioni sono state scartate e l'ultimo motivo. */
const rejectedStatus = (m: Map<string, string>) => ({ count: m.size, message: [...m.values()].at(-1) ?? null });

async function post(matchId: number, events: LiveEvent[]): Promise<PostResult> {
  const res = await fetch(`/api/matches/${matchId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  }).catch(() => null);
  if (!res) return { kind: "offline" };
  if (res.ok) return { kind: "ok" };
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  const message = body?.error ?? `Errore ${res.status}`;
  // 400/422: dati non validi, reinviarli non serve. 401: sessione scaduta. Il resto: si riprova.
  if (res.status === 400 || res.status === 422) return { kind: "rejected", message };
  if (res.status === 401) return { kind: "auth", message };
  return { kind: "error", message };
}

/** start: id del Live (formazione del 1° set) per non riprendere la copia locale di un Live precedente. */
export function useLiveEvents(matchId: number, start: number | null, initial: LiveEvent[]) {
  // Il ref è la fonte di verità (letture sempre aggiornate anche tra due tocchi rapidi);
  // lo state serve solo a ridisegnare.
  const eventsRef = useRef(new Map(initial.map((e) => [e.id, e])));
  const [events, setEvents] = useState(eventsRef.current);
  const historyRef = useRef<History>(EMPTY_HISTORY);
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);

  const queue = useRef(new Map<string, LiveEvent>());
  const rejected = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ restoring: true, pending: 0, problem: null, message: null, rejected: { count: 0, message: null } });

  /** Il server ha queste versioni: fuori dalla coda (se nel frattempo un evento è cambiato, resta). */
  const ack = useCallback((batch: LiveEvent[]) => {
    for (const e of batch) if (queue.current.get(e.id) === e) queue.current.delete(e.id);
    void markSynced(batch);
  }, []);

  /** Blocco rifiutato: si manda un evento alla volta e si mette da parte solo quello non valido. */
  const sendOneByOne = useCallback(
    async (batch: LiveEvent[]): Promise<Problem | null> => {
      for (const e of batch) {
        if (queue.current.get(e.id) !== e) continue;
        const res = await post(matchId, [e]);
        if (res.kind === "ok") ack([e]);
        else if (res.kind === "rejected") {
          queue.current.delete(e.id);
          rejected.current.set(e.id, res.message);
        } else return res;
      }
      return null;
    },
    [matchId, ack],
  );

  const flush = useCallback(async () => {
    if (inFlight.current || queue.current.size === 0) return;
    inFlight.current = true;
    let problem: Problem | null = null;
    try {
      while (queue.current.size > 0 && !problem) {
        const batch = [...queue.current.values()].slice(0, BATCH_SIZE);
        const res = await post(matchId, batch);
        if (res.kind === "ok") ack(batch);
        else if (res.kind === "rejected") problem = await sendOneByOne(batch);
        else problem = res;
      }
    } finally {
      inFlight.current = false;
    }
    setSync((s) => ({
      ...s,
      pending: queue.current.size,
      problem: problem?.kind ?? null,
      message: problem && "message" in problem ? problem.message : null,
      rejected: rejectedStatus(rejected.current),
    }));
    if (problem) {
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, RETRY_MS);
    } else if (queue.current.size > 0 && !timer.current) void flush();
  }, [matchId, ack, sendOneByOne]);

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
    void loadLocalLog(matchId, start).then((local) => {
      if (cancelled) return;
      setSync((s) => ({ ...s, restoring: false }));
      if (local.length === 0) return;
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
  }, [matchId, start, scheduleFlush]);

  // Appena torna la rete (o si torna sull'app) si riprova subito.
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState !== "visible") return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      void flush();
    };
    const onOffline = () => setSync((s) => ({ ...s, problem: "offline", message: null }));
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
      void saveLocal(matchId, start, version);
      queue.current.set(version.id, version);
      // Una nuova versione di un evento scartato riprova a passare.
      rejected.current.delete(version.id);
      setSync((s) => ({ ...s, pending: queue.current.size, rejected: rejectedStatus(rejected.current) }));
      scheduleFlush();
    },
    [matchId, start, scheduleFlush],
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
