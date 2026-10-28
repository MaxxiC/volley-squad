// Riepilogo pubblico di fine partita (src/lib/match-report.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bestPlayers, comparison, playerLine, pointSplit } from "@/lib/match-report";
import { eventFactory } from "./helpers";

const ev = eventFactory();
const our = (playerId: number, skill: string, outcome: string, point: "us" | "them" | null, o = {}) =>
  ev({ playerId, skill: skill as never, outcome, point, ...o });

const EVENTS = [
  our(4, "attack", "kill", "us", { star: true }),
  our(4, "attack", "kill", "us"),
  our(4, "attack", "error", "them"),
  our(6, "attack", "kill", "us"),
  our(5, "block", "point", "us"),
  our(2, "serve", "ace", "us"),
  our(2, "serve", "error", "them"),
  our(3, "serve", "ace", "us"),
  ev({ skill: "opp_error", point: "us", detail: { ballType: "free" } }),
  ev({ skill: "opp_point", point: "them" }),
  ev({ skill: "opp_point", point: "them" }),
  ev({ skill: "opp_point", point: "them" }),
  ev({ point: "us", incomplete: true }),
  our(9, "reception", "perfect", null),
  our(9, "reception", "good", null),
  our(9, "reception", "poor", null),
  our(1, "reception", "perfect", null),
  our(4, "attack", "kill", "us", { deleted: true }),
];

describe("come abbiamo fatto punto", () => {
  test("per tipo, con Altro solo se ci sono punti non completati", () => {
    assert.deepEqual(
      pointSplit(EVENTS).map((p) => [p.key, p.value]),
      [["attack", 3], ["block", 1], ["ace", 2], ["opp_error", 1], ["other", 1]],
    );
    assert.equal(pointSplit(EVENTS.slice(0, 3)).some((p) => p.key === "other"), false);
  });
});

describe("i migliori", () => {
  test("attacco, muro, battuta e ricezione (minimo 3 ricezioni)", () => {
    assert.deepEqual(bestPlayers(EVENTS), [
      { category: "Attacco", playerId: 4, value: "2 punti · 33%" },
      { category: "Muro", playerId: 5, value: "1 punto" },
      { category: "Battuta", playerId: 3, value: "1 ace · 0 errori" },
      { category: "Ricezione", playerId: 9, value: "67% positiva" },
    ]);
  });

  test("senza dati nessuna card", () => {
    assert.deepEqual(bestPlayers([ev({ skill: "opp_point", point: "them" })]), []);
  });
});

describe("squadra a confronto", () => {
  test("punti conquistati, errori regalati, serie più lunga dentro il set", () => {
    const rows = comparison(EVENTS, [{ us: 25, them: 20 }]);
    assert.deepEqual(rows.map((r) => [r.label, r.us, r.them]), [
      ["Punti totali", 25, 20],
      ["Punti conquistati", 6, 3],
      ["Errori (punti regalati)", 2, 1],
      ["Serie più lunga", 3, 3],
    ]);
  });

  test("la serie si interrompe a fine set", () => {
    const e = [ev({ point: "us" }), ev({ point: "us" }), ev({ kind: "set_end" }), ev({ point: "us" })];
    assert.equal(comparison(e, []).at(-1)?.us, 2);
  });
});

describe("riga dell'MVP", () => {
  test("punti, efficienza in attacco, stelline", () => {
    assert.deepEqual(playerLine(EVENTS, 4), { points: 2, attack: 33, stars: 1 });
    assert.deepEqual(playerLine(EVENTS, 7), { points: 0, attack: null, stars: 0 });
  });
});
