// Annulla / Ripeti del Live (src/lib/live/history.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_HISTORY, historyFromLog, record, redo, restoreHistory, trimHistory, undo } from "@/lib/live/history";
import type { LiveEvent } from "@/lib/live/types";
import { eventFactory } from "./helpers";

const ev = eventFactory();
// Punto in modalità semplice ("da completare"), poi completato con fondamentale e giocatore.
const added = ev({ point: "us", incomplete: true });
const completed = { ...added, incomplete: false, skill: "attack" as const, outcome: "kill", playerId: 2 };

function twoOps() {
  return record(record(EMPTY_HISTORY, { before: null, after: added }), { before: added, after: completed });
}

test("storia vuota: niente da annullare né ripetere", () => {
  assert.equal(undo(EMPTY_HISTORY), null);
  assert.equal(redo(EMPTY_HISTORY), null);
});

test("annullare un completamento rimette la versione prima", () => {
  const u = undo(twoOps());
  assert.ok(u);
  assert.equal(u.apply.incomplete, true);
  assert.equal(u.apply.deleted, false);
  assert.equal(u.apply.skill, null);
});

test("annullare un evento appena aggiunto lo marca annullato (resta nel registro)", () => {
  const u1 = undo(twoOps());
  assert.ok(u1);
  const u2 = undo(u1.history);
  assert.ok(u2);
  assert.equal(u2.apply.id, added.id);
  assert.equal(u2.apply.deleted, true);
  assert.equal(undo(u2.history), null);
});

test("ripetere rimette le versioni dopo, nell'ordine giusto", () => {
  const u1 = undo(twoOps());
  assert.ok(u1);
  const u2 = undo(u1.history);
  assert.ok(u2);
  const r1 = redo(u2.history);
  assert.ok(r1);
  assert.equal(r1.apply.deleted, false);
  assert.equal(r1.apply.incomplete, true);
  const r2 = redo(r1.history);
  assert.ok(r2);
  assert.equal(r2.apply.skill, "attack");
  assert.equal(redo(r2.history), null);
});

test("una nuova azione svuota Ripeti", () => {
  const u = undo(twoOps());
  assert.ok(u);
  const fresh = record(u.history, { before: null, after: ev({ point: "them" }) });
  assert.equal(fresh.undone.length, 0);
  assert.equal(redo(fresh), null);
  assert.equal(fresh.done.length, 2);
});

/** Registro attuale come lo vede la pagina dopo il ricaricamento. */
const log = (...events: LiveEvent[]) => new Map(events.map((e) => [e.id, e]));
/** Stessa versione arrivata dal server: campi in un altro ordine (anche dentro detail). */
const fromServer = (e: LiveEvent): LiveEvent => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(e).reverse())));

test("dopo il ricaricamento la pila salvata si riprende identica (anche con i campi riordinati dal server)", () => {
  const saved = twoOps();
  const restored = restoreHistory(saved, log(fromServer(completed)));
  assert.equal(restored, saved);
  const u = undo(restored);
  assert.equal(u?.apply.incomplete, true, "si annulla il completamento, non tutto il punto");
});

test("pila con un annullamento: si riprende e Ripeti funziona", () => {
  const u = undo(twoOps())!;
  const restored = restoreHistory(u.history, log(fromServer(added)));
  assert.equal(restored, u.history);
  assert.equal(redo(restored)?.apply.skill, "attack");
});

test("pila che non torna col registro (azioni fatte altrove): si ricostruisce dal registro", () => {
  const other = ev({ point: "them" });
  const restored = restoreHistory(twoOps(), log(completed, other));
  assert.deepEqual(restored.done.map((op) => op.after.id), [completed.id, other.id]);
  assert.equal(undo(restored)?.apply.id, other.id);
  assert.equal(undo(restored)?.apply.deleted, true);
});

test("senza pila salvata: si annulla l'ultima azione valida del registro, poi la precedente", () => {
  const a = ev({ point: "us" });
  const b = ev({ point: "them", deleted: true });
  const c = ev({ point: "us" });
  const h = historyFromLog([c, a, b]);
  assert.deepEqual(h.done.map((op) => op.after.id), [a.id, c.id], "in ordine di registrazione, annullate escluse");
  assert.equal(restoreHistory(null, log(a, b, c)).done.length, 2);
  const u1 = undo(h)!;
  assert.equal(u1.apply.id, c.id);
  assert.equal(undo(u1.history)?.apply.id, a.id);
});

test("pila salvata con un limite di operazioni", () => {
  let h = EMPTY_HISTORY;
  for (let i = 0; i < 350; i++) h = record(h, { before: null, after: ev() });
  assert.equal(trimHistory(h).done.length, 300);
});
