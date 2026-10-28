// Annulla / Ripeti del Live (src/lib/live/history.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_HISTORY, record, redo, undo } from "@/lib/live/history";
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
