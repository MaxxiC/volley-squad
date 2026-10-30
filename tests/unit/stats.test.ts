// Statistiche dei giocatori: conteggi, efficienza, card per ruolo, ruolo di partita (src/lib/stats.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bestWorstWindows,
  countsByPlayer,
  efficiency,
  efficiencyTone,
  formatPct,
  matchRoles,
  mergeCounts,
  mergePlayingTime,
  oppErrorSplit,
  playingTime,
  pointsAndErrors,
  pointsGiven,
  skillGroups,
} from "@/lib/stats";
import { computeLive } from "@/lib/live/state";
import { eventFactory, lineup } from "./helpers";

const ev = eventFactory();
const act = (playerId: number, skill: string, outcome: string, o = {}) => ev({ playerId, skill: skill as never, outcome, ...o });

describe("conteggi", () => {
  test("solo azioni valide con giocatore, fondamentale ed esito", () => {
    const c = countsByPlayer([
      act(4, "attack", "kill"),
      act(4, "attack", "kill"),
      act(4, "attack", "error"),
      act(4, "attack", "kill", { deleted: true }),
      ev({ point: "us", incomplete: true }),
      ev({ skill: "opp_error", point: "us" }),
      act(5, "reception", "good"),
    ]);
    assert.deepEqual(c.get(4)?.attack, { kill: 2, error: 1 });
    assert.deepEqual(c.get(5)?.reception, { good: 1 });
    assert.equal(c.size, 2);
  });

  test("somma di più partite", () => {
    const a = countsByPlayer([act(4, "serve", "ace")]).get(4)!;
    const b = countsByPlayer([act(4, "serve", "ace"), act(4, "serve", "error")]).get(4)!;
    assert.deepEqual(mergeCounts([a, b]).serve, { ace: 2, error: 1 });
  });
});

describe("efficienza (formule del README)", () => {
  const counts = (skill: string, outcomes: Record<string, number>) =>
    countsByPlayer(Object.entries(outcomes).flatMap(([k, n]) => Array.from({ length: n }, () => act(1, skill, k)))).get(1)!;

  test("battuta: (ace − errori) / totale", () => {
    assert.equal(efficiency("serve", counts("serve", { ace: 3, in: 5, error: 2 })), 10);
  });
  test("ricezione: (perfette + buone×0.5 − errori) / totale", () => {
    assert.equal(efficiency("reception", counts("reception", { perfect: 4, good: 4, poor: 1, error: 1 })), 50);
  });
  test("attacco: (punti − errori − murati) / totale, anche negativa", () => {
    assert.equal(efficiency("attack", counts("attack", { kill: 6, in: 2, blocked: 1, error: 1 })), 40);
    assert.equal(efficiency("attack", counts("attack", { blocked: 1, error: 1 })), -100);
  });
  test("muro: punti / (punti + tocchi + invasioni)", () => {
    assert.equal(efficiency("block", counts("block", { point: 1, touch: 2, net: 1 })), 25);
  });
  test("alzata: buone / totale", () => {
    assert.equal(efficiency("set", counts("set", { good: 2, poor: 1 })), 67);
  });
  test("senza azioni: nessuna efficienza; colori a 50 e 30", () => {
    assert.equal(efficiency("set", counts("attack", { kill: 1 })), null);
    assert.deepEqual([50, 49, 30, 29, null].map(efficiencyTone), ["gold", "ink", "ink", "red", "ink"]);
    assert.deepEqual([35, 0, -33, null].map(formatPct), ["35%", "0%", "−33%", "—"]);
  });
});

describe("card da mostrare", () => {
  test("fondamentali del ruolo, più quelli fuori ruolo con azioni", () => {
    const c = countsByPlayer([act(1, "reception", "good")]).get(1)!;
    // Centrale con una ricezione: attacco, muro e battuta in evidenza (anche senza azioni), ricezione fuori ruolo.
    assert.deepEqual(skillGroups(c, ["C"]), { focus: ["attack", "serve", "block"], others: ["reception"] });
    assert.deepEqual(skillGroups(c, ["L"]), { focus: ["reception"], others: [] });
    // Più ruoli giocati: i fondamentali di tutti.
    assert.deepEqual(skillGroups(c, ["P", "L"]).focus, ["reception", "serve", "block", "set"]);
  });
});

describe("ruolo di partita", () => {
  test("dai presenti, o dal cambio con cui è entrato", () => {
    const roles = matchRoles(
      [
        { playerId: 5, role: "C" },
        { playerId: 7, role: "S" },
      ],
      [ev({ kind: "sub", detail: { in: 7, out: 3, role: "O" } }), ev({ kind: "sub", detail: { in: 5, out: 2, role: "S" }, deleted: true })],
    );
    assert.equal(roles.get(5), "C", "cambio annullato: non conta");
    assert.equal(roles.get(7), "O");
  });
});

describe("andamento: periodo migliore e peggiore", () => {
  test("finestre di 3 partite con la media più alta e più bassa", () => {
    assert.deepEqual(bestWorstWindows([40, 10, 20, 30, 80, 70, 60]), {
      best: { start: 4, avg: 70 },
      worst: { start: 1, avg: 20 },
      size: 3,
    });
  });

  test("a parità vince la prima finestra", () => {
    assert.equal(bestWorstWindows([50, 50, 50, 10, 50, 50, 50])?.best.start, 0);
  });

  test("poche partite o tutte uguali: nessuna banda", () => {
    assert.equal(bestWorstWindows([10, 20, 30]), null);
    assert.equal(bestWorstWindows([40, 40, 40, 40]), null);
  });
});

describe("tempo in campo", () => {
  test("punti giocati, set e set interi; il cambio conta da quando entra", () => {
    const e = eventFactory();
    const s = computeLive(lineup("us"), [
      e({ point: "us" }),
      e({ point: "us" }),
      // Entra il 7 per il 3: gioca solo gli ultimi due punti del set 1.
      e({ kind: "sub", detail: { out: 3, in: 7, role: "S" } }),
      e({ point: "them" }),
      e({ point: "us" }),
    ]);
    assert.ok(s);
    assert.equal(s.rallies.length, 4);
    const t = playingTime(s.rallies);
    assert.deepEqual(t.get(1), { rallies: 4, sets: 1, fullSets: 1 });
    assert.deepEqual(t.get(3), { rallies: 2, sets: 1, fullSets: 0 });
    assert.deepEqual(t.get(7), { rallies: 2, sets: 1, fullSets: 0 });
    assert.equal(t.has(9), false); // libero mai entrato (senza ruoli non entra da solo)
  });

  test("i punti di tutti i set restano, non solo quelli del set in corso", () => {
    const e = eventFactory();
    const events = [...Array.from({ length: 25 }, () => e({ point: "us" })), e({ kind: "set_end" }), e({ point: "them" })];
    const s = computeLive(lineup("us"), events);
    assert.ok(s);
    assert.equal(s.rallies.length, 26);
    assert.deepEqual(playingTime(s.rallies).get(2), { rallies: 26, sets: 2, fullSets: 2 });
  });

  test("correzioni, timeout e azioni senza punto non sono punti giocati", () => {
    const e = eventFactory();
    const s = computeLive(lineup("us"), [
      e({ kind: "correction", point: "us", detail: { delta: 1 } }),
      e({ kind: "timeout", detail: { side: "us" } }),
      e({ skill: "reception", outcome: "good", playerId: 2 }),
      e({ point: "us", deleted: true }),
    ]);
    assert.equal(s?.rallies.length, 0);
  });

  test("somma di più partite", () => {
    assert.deepEqual(
      mergePlayingTime([
        { rallies: 40, sets: 2, fullSets: 1 },
        { rallies: 6, sets: 1, fullSets: 0 },
      ]),
      { rallies: 46, sets: 3, fullSets: 1 },
    );
  });
});

describe("punti, errori e punti regalati", () => {
  test("punti fatti ed errori per giocatore (solo azioni valide)", () => {
    const r = pointsAndErrors([
      act(1, "attack", "kill", { point: "us" }),
      act(1, "serve", "ace", { point: "us" }),
      act(1, "attack", "blocked", { point: "them" }),
      act(1, "attack", "in"),
      act(1, "attack", "kill", { point: "us", deleted: true }),
      act(2, "fault", "double", { point: "them" }),
    ]);
    assert.deepEqual(r.get(1), { points: 2, errors: 1 });
    assert.deepEqual(r.get(2), { points: 0, errors: 1 });
  });

  test("punti dell'avversario per tipo, murati a parte, senza voci a zero", () => {
    const r = pointsGiven([
      ev({ point: "them", skill: "opp_point" }),
      ev({ point: "them", skill: "opp_point" }),
      act(1, "attack", "error", { point: "them" }),
      act(1, "attack", "blocked", { point: "them" }),
      act(2, "serve", "error", { point: "them" }),
      ev({ point: "them", skill: "fault", outcome: "position" }),
      ev({ point: "them" }), // mai completato
      ev({ point: "us", skill: "opp_error" }),
    ]);
    assert.deepEqual(
      r.map((x) => [x.key, x.value]),
      [
        ["opp_point", 2],
        ["serve", 1],
        ["attack", 1],
        ["blocked", 1],
        ["fault", 1],
        ["other", 1],
      ],
    );
  });

  test("errori avversari per tipo; quelli vecchi senza tipo in \"Altro\"", () => {
    const r = oppErrorSplit([
      ev({ point: "us", skill: "opp_error", detail: { oppError: "serve" } }),
      ev({ point: "us", skill: "opp_error", detail: { oppError: "serve" } }),
      ev({ point: "us", skill: "opp_error", detail: { ballType: "free" } }),
      ev({ point: "us", skill: "opp_error", detail: { oppError: "net" }, deleted: true }),
    ]);
    assert.deepEqual(
      r.map((x) => [x.key, x.value]),
      [
        ["serve", 2],
        ["other", 1],
      ],
    );
  });
});
