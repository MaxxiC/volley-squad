// Statistiche dei giocatori: conteggi, efficienza, card per ruolo, ruolo di partita (src/lib/stats.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bestWorstWindows, countsByPlayer, efficiency, efficiencyTone, formatPct, matchRoles, mergeCounts, skillLines } from "@/lib/stats";
import { eventFactory } from "./helpers";

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
    assert.deepEqual(skillLines(c, ["C"]).map((l) => l.skill), ["attack", "reception", "serve", "block"]);
    assert.deepEqual(skillLines(c, ["L"]).map((l) => l.skill), ["reception"]);
    assert.equal(skillLines(c, ["C"])[1].detail, "Perfette 0 · Buone 1 · Scarse 0 · Errori 0");
    assert.equal(skillLines(c, ["C"])[0].eff, null);
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
