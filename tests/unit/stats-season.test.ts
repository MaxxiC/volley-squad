// Statistiche di più partite (src/lib/stats-season.ts): numeri di una partita e somma.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { matchStat, sumMatches } from "@/lib/stats-season";
import { eventFactory, lineup } from "./helpers";

const meta = (id: number, won: boolean) => ({ id, label: `A${id}`, title: `Andata ${id}ª`, result: won ? "3–0" : "0–3", won });
// P1..P6 = 1..6 (alzatore in P1, centrali 3 e 6), libero 9; il 7 in panchina.
const present = [
  { playerId: 1, role: "P" as const },
  { playerId: 2, role: "S" as const },
  { playerId: 3, role: "C" as const },
  { playerId: 4, role: "O" as const },
  { playerId: 5, role: "S" as const },
  { playerId: 6, role: "C" as const },
  { playerId: 7, role: "S" as const },
  { playerId: 9, role: "L" as const },
];

describe("numeri di una partita", () => {
  test("giocatori presenti, punti, errori, stelline e tempo in campo (libero automatico compreso)", () => {
    const ev = eventFactory();
    const m = matchStat(meta(1, true), lineup("us"), [
      ev({ point: "us", skill: "attack", outcome: "kill", playerId: 4, star: true }),
      ev({ point: "them", skill: "serve", outcome: "error", playerId: 4 }),
      ev({ skill: "reception", outcome: "good", playerId: 9 }),
      ev({ point: "us", skill: "opp_error", detail: { oppError: "serve" } }),
    ], present);
    assert.deepEqual(Object.keys(m.players).map(Number).sort(), [1, 2, 3, 4, 5, 6, 7, 9]);
    assert.equal(m.players[4].points, 1);
    assert.equal(m.players[4].errors, 1);
    assert.equal(m.players[4].stars, 1);
    assert.equal(m.players[4].counts.attack.kill, 1);
    assert.deepEqual(m.players[4].time, { rallies: 3, sets: 1, fullSets: 1 });
    // Il 7 era presente ma non è mai entrato.
    assert.deepEqual(m.players[7].time, { rallies: 0, sets: 0, fullSets: 0 });
    // Con i ruoli il libero entra da solo per il centrale in seconda linea (il 6 in P6).
    assert.ok(m.players[9].time.rallies > 0);
    assert.equal(m.players[9].time.rallies + m.players[6].time.rallies, 3);
    assert.deepEqual(m.oppErrors.map((s) => [s.key, s.value]), [["serve", 1]]);
    assert.deepEqual(m.given.map((s) => [s.key, s.value]), [["serve", 1]]);
  });

  test("chi entra con un cambio conta nella partita con il ruolo del cambio", () => {
    const ev = eventFactory();
    const m = matchStat(meta(1, true), lineup("us"), [ev({ kind: "sub", detail: { out: 2, in: 8, role: "O" } }), ev({ point: "us" })], present);
    assert.equal(m.players[8].role, "O");
    assert.deepEqual(m.players[8].time, { rallies: 1, sets: 1, fullSets: 1 });
  });
});

describe("somma di più partite", () => {
  test("totali per giocatore, ruoli dal più giocato, squadra e vittorie", () => {
    const ev = eventFactory();
    const a = matchStat(meta(1, true), lineup("us"), [ev({ point: "us", skill: "attack", outcome: "kill", playerId: 2 }), ev({ point: "us", skill: "opp_error" })], present);
    const ev2 = eventFactory();
    const b = matchStat(
      meta(2, false),
      lineup("us"),
      [ev2({ point: "us", skill: "attack", outcome: "kill", playerId: 2 }), ev2({ point: "them", skill: "opp_point" })],
      present.map((p) => (p.playerId === 2 ? { ...p, role: "O" as const } : p)),
    );
    const sum = sumMatches([a, b]);
    const p2 = sum.players.find((p) => p.playerId === 2);
    assert.ok(p2);
    assert.equal(p2.matches, 2);
    assert.equal(p2.points, 2);
    assert.equal(p2.counts.attack.kill, 2);
    assert.equal(p2.time.rallies, 4);
    assert.deepEqual(p2.roles.map((r) => r.matches), [1, 1]);
    // In testa chi ha fatto più punti.
    assert.equal(sum.players[0].playerId, 2);
    assert.deepEqual(sum.scored.map((s) => [s.key, s.value]), [
      ["attack", 2],
      ["opp_error", 1],
    ]);
    assert.deepEqual(sum.oppErrors.map((s) => [s.key, s.value]), [["other", 1]]);
    assert.deepEqual(sum.given.map((s) => [s.key, s.value]), [["opp_point", 1]]);
    assert.equal(sum.won, 1);
  });

  test("nessuna partita: tutto vuoto", () => {
    const sum = sumMatches([]);
    assert.deepEqual(sum, { players: [], scored: [], oppErrors: [], given: [], won: 0 });
  });
});
