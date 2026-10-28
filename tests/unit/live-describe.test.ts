// Testi del feed "Ultime azioni" (src/lib/live/describe.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { describeEvent, playerLabel } from "@/lib/live/describe";
import type { LivePlayer } from "@/lib/live/types";
import { eventFactory } from "./helpers";

const roster = new Map<number, LivePlayer>([
  [2, { id: 2, number: 7, firstName: "Mattia", lastName: "Botticelli", role: "S", gender: "M" }],
  [3, { id: 3, number: 3, firstName: "Claudio", lastName: "", role: "S", gender: null }],
  [9, { id: 9, number: 2, firstName: "Alessia", lastName: "Federici", role: "L", gender: "F" }],
  [19, { id: 19, number: 9, firstName: "Daniel", lastName: "Casadei", role: "L", gender: "M" }],
]);
const playerOf = (id: number) => roster.get(id);
const OPP = "Dinamite";
const ev = eventFactory();
const text = (o: Parameters<typeof ev>[0]) => describeEvent(ev(o), playerOf, OPP);

test("etichetta giocatore: numero e cognome, o il nome se manca il cognome", () => {
  assert.equal(playerLabel(roster.get(2)), "#7 Botticelli");
  assert.equal(playerLabel(roster.get(3)), "#3 Claudio");
  assert.equal(playerLabel(undefined), "giocatore?");
});

test("azioni con fondamentale ed esito", () => {
  assert.equal(text({ point: "us", skill: "attack", outcome: "kill", playerId: 2 }), "Attacco punto · #7 Botticelli");
  assert.equal(text({ skill: "reception", outcome: "good", playerId: 9 }), "Ricezione buona · #2 Federici");
  assert.equal(text({ point: "them", skill: "serve", outcome: "error", playerId: 3 }), "Battuta errore · #3 Claudio");
});

test("punti da completare e dell'avversario", () => {
  assert.equal(text({ point: "us", incomplete: true }), "Punto CUSBros");
  assert.equal(text({ point: "them", incomplete: true }), "Punto Dinamite");
  assert.equal(text({ point: "them", skill: "opp_point" }), "Punto Dinamite");
  assert.equal(text({ point: "us", skill: "opp_error", detail: { ballType: "free" } }), "Errore Dinamite · palla semplice nostra");
  assert.equal(text({ point: "us", skill: "opp_error", detail: { ballType: "rally" } }), "Errore Dinamite · azione loro");
  assert.equal(text({ point: "us", skill: "opp_error" }), "Errore Dinamite");
});

test("eventi di gestione della partita", () => {
  assert.equal(text({ kind: "rotation", detail: { dir: 1 } }), "Rotazione manuale");
  assert.equal(text({ kind: "rotation", detail: { dir: -1 } }), "Rotazione indietro");
  assert.equal(text({ kind: "set_end" }), "Fine set");
  assert.equal(text({ kind: "lineup", setN: 2 }), "Formazione set 2");
  assert.equal(text({ kind: "timeout", detail: { side: "us" } }), "Timeout CUSBros");
  assert.equal(text({ kind: "timeout", detail: { side: "them" } }), "Timeout Dinamite");
  assert.equal(text({ kind: "correction", point: "them", detail: { delta: 1 } }), "Correzione punteggio: +1 Dinamite");
  assert.equal(text({ kind: "correction", point: "us", detail: { delta: -1 } }), "Correzione punteggio: −1 CUSBros");
});

test("cambi e libero", () => {
  assert.equal(text({ kind: "sub", detail: { in: 2, out: 3, role: "O" } }), "Cambio · entra #7 Botticelli (Opposto), esce #3 Claudio");
  assert.equal(text({ kind: "sub", detail: { in: 2, out: 3 } }), "Cambio · entra #7 Botticelli, esce #3 Claudio");
  assert.equal(text({ kind: "libero", detail: { in: 9, out: 2 } }), "Libero entra per #7 Botticelli");
  assert.equal(text({ kind: "libero", detail: { in: 2, out: 9 } }), "Libero esce · rientra #7 Botticelli");
  assert.equal(text({ kind: "libero", detail: { in: 9 } }), "Libero scelto · #2 Federici");
  assert.equal(text({ kind: "libero", detail: { in: 19, out: 9 } }), "Cambio libero · entra #9 Casadei, esce #2 Federici");
});
