// Stato del Live ricostruito dal registro eventi (src/lib/live/state.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeLive, rotateClockwise, setWinnerOf, subWarning, type LiveState } from "@/lib/live/state";
import { eventFactory, lineup, points, wonSet } from "./helpers";

/** computeLive senza null: nei test c'è sempre la formazione del set 1. */
function live(...args: Parameters<typeof computeLive>): LiveState {
  const s = computeLive(...args);
  assert.ok(s, "computeLive ha restituito null");
  return s;
}

describe("punti, battuta e rotazione", () => {
  test("senza formazione del set 1 non c'è stato", () => {
    assert.equal(computeLive([], []), null);
  });

  test("rotazione oraria: chi era in P2 va in P1", () => {
    assert.deepEqual(rotateClockwise([1, 2, 3, 4, 5, 6]), [2, 3, 4, 5, 6, 1]);
  });

  test("cambio palla a nostro favore: si ruota e si va in battuta", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), [ev({ point: "us" })]);
    assert.deepEqual(s.rotation, [2, 3, 4, 5, 6, 1]);
    assert.equal(s.serving, "us");
    assert.deepEqual(s.score, { us: 1, them: 0 });
  });

  test("punto nostro mentre battiamo: niente rotazione", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ point: "us" }), ev({ point: "us" })]);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(s.score.us, 2);
  });

  test("punto loro: battuta a loro, nessuna rotazione nostra", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), [ev({ point: "us" }), ev({ point: "them" })]);
    assert.equal(s.serving, "them");
    assert.deepEqual(s.score, { us: 1, them: 1 });
    assert.deepEqual(s.rotation, [2, 3, 4, 5, 6, 1]);
  });

  test("azione senza punto non cambia punteggio né battuta ma va nella timeline", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), [ev({ skill: "reception", outcome: "good" })]);
    assert.deepEqual(s.score, { us: 0, them: 0 });
    assert.equal(s.serving, "them");
    assert.equal(s.timeline.length, 1);
    assert.equal(s.setNotStarted, false);
  });

  test("evento annullato non conta", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), [ev({ point: "us", deleted: true })]);
    assert.equal(s.score.us, 0);
    assert.equal(s.serving, "them");
    assert.equal(s.timeline.length, 0);
    assert.equal(s.setNotStarted, true);
  });

  test("gli eventi si applicano in ordine di seq, non di arrivo", () => {
    const ev = eventFactory();
    const a = ev({ point: "us" });
    const b = ev({ point: "them" });
    const s = live(lineup("them"), [b, a]);
    assert.equal(s.serving, "them");
    assert.equal(s.timeline[0].event.id, a.id);
  });

  test("rotazione manuale avanti e indietro", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "rotation", detail: { dir: 1 } })]);
    assert.deepEqual(s.rotation, [2, 3, 4, 5, 6, 1]);
    const back = live(lineup("us"), [ev({ kind: "rotation", detail: { dir: 1 } }), ev({ kind: "rotation", detail: { dir: -1 } })]);
    assert.deepEqual(back.rotation, [1, 2, 3, 4, 5, 6]);
  });

  test("la timeline riporta il punteggio dopo ogni evento", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ point: "us" }), ev({ point: "them" })]);
    assert.deepEqual(
      s.timeline.map((t) => t.score),
      [
        { us: 1, them: 0 },
        { us: 1, them: 1 },
      ],
    );
  });
});

describe("fine set e fine partita", () => {
  const cases: [number, number, number, "us" | "them" | null][] = [
    [1, 25, 23, "us"],
    [1, 25, 24, null],
    [2, 25, 27, "them"],
    [3, 24, 22, null],
    [5, 15, 13, "us"],
    [5, 15, 14, null],
    [1, 15, 13, null],
  ];
  for (const [setN, us, them, winner] of cases) {
    test(`set ${setN}, ${us}–${them}: ${winner ?? "non finito"}`, () => {
      assert.equal(setWinnerOf(setN, { us, them }), winner);
    });
  }

  test("set_end: punteggio azzerato, set vinto, parziale registrato", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), wonSet(ev));
    assert.equal(s.setN, 2);
    assert.deepEqual(s.sets, { us: 1, them: 0 });
    assert.deepEqual(s.score, { us: 0, them: 0 });
    assert.deepEqual(s.finishedSets, [{ n: 1, us: 25, them: 0 }]);
    assert.equal(s.setNotStarted, true);
  });

  test("setWinner segnalato a 25 prima di chiudere il set", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), points(ev, "us", 25));
    assert.equal(s.setWinner, "us");
    assert.equal(s.setN, 1);
  });

  test("al set successivo batte per primo chi aveva ricevuto", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), wonSet(ev));
    assert.equal(s.serveFirst, "us");
    assert.equal(s.serving, "us");
  });

  test("formazione del set successivo come evento", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [...wonSet(ev), ev({ kind: "lineup", detail: { slots: [6, 5, 4, 3, 2, 1], liberoId: 9, serveFirst: "us" } })]);
    assert.equal(s.setN, 2);
    assert.deepEqual(s.rotation, [6, 5, 4, 3, 2, 1]);
    assert.equal(s.serving, "us");
    assert.equal(s.setNotStarted, true);
  });

  test("formazione ignorata se il set è già iniziato", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [
      ...wonSet(ev),
      ev({ point: "them" }),
      ev({ kind: "lineup", detail: { slots: [6, 5, 4, 3, 2, 1], liberoId: 9, serveFirst: "us" } }),
    ]);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
  });

  test("formazione salvata per il set 2 (tabella lineups) usata al cambio set", () => {
    const ev = eventFactory();
    const lineups = [...lineup("us"), { setN: 2, slots: [3, 4, 5, 6, 1, 2], liberoId: null, serveFirst: "them" as const }];
    const s = live(lineups, wonSet(ev));
    assert.deepEqual(s.rotation, [3, 4, 5, 6, 1, 2]);
    assert.equal(s.liberoId, null);
    assert.equal(s.serving, "them");
  });

  test("tre set vinti: partita finita", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [...wonSet(ev), ...wonSet(ev), ...wonSet(ev)]);
    assert.equal(s.matchOver, true);
    assert.deepEqual(s.sets, { us: 3, them: 0 });
    assert.equal(s.finishedSets.length, 3);
  });

  test("parziali di set vinti e persi", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [...wonSet(ev), ...wonSet(ev, "them")]);
    assert.deepEqual(s.finishedSets, [
      { n: 1, us: 25, them: 0 },
      { n: 2, us: 0, them: 25 },
    ]);
    assert.equal(s.matchOver, false);
  });

  test("al tie-break si chiude a 15", () => {
    const ev = eventFactory();
    const twoAll = [...wonSet(ev), ...wonSet(ev, "them"), ...wonSet(ev), ...wonSet(ev, "them")];
    const s = live(lineup("us"), [...twoAll, ...points(ev, "us", 15)]);
    assert.equal(s.setN, 5);
    assert.equal(s.setWinner, "us");
  });
});

describe("cambi", () => {
  test("il cambio sostituisce, conta e ricorda il ruolo", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "sub", detail: { out: 2, in: 7, role: "S" } })]);
    assert.deepEqual(s.rotation, [1, 7, 3, 4, 5, 6]);
    assert.equal(s.subs, 1);
    assert.equal(s.roles[7], "S");
  });

  test("regola del rientro", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "sub", detail: { out: 2, in: 7 } })]);
    assert.equal(subWarning(s, 7, 2), null, "rientro del titolare al posto di chi l'ha sostituito");
    assert.match(subWarning(s, 4, 2) ?? "", /Rientro non regolare/);
    assert.match(subWarning(s, 7, 8) ?? "", /far rientrare il titolare/);
    assert.equal(subWarning(s, 4, 8), null, "cambio libero da vincoli");
  });

  test("oltre 6 cambi per set si avvisa", () => {
    const ev = eventFactory();
    const six = [1, 2, 3, 4, 5, 6].map((out, i) => ev({ kind: "sub", detail: { out, in: 20 + i } }));
    const s = live(lineup("us"), six);
    assert.equal(s.subs, 6);
    assert.match(subWarning(s, 20, 1) ?? "", /finiti/);
  });

  test("i cambi ripartono da zero nel set successivo, i ruoli restano", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "sub", detail: { out: 2, in: 7, role: "O" } }), ...wonSet(ev)]);
    assert.equal(s.subs, 0);
    assert.deepEqual(s.subPairs, {});
    assert.equal(s.roles[7], "O");
  });
});

describe("libero", () => {
  test("entra senza contare come cambio", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 9, out: 5 } })]);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 9, 6]);
    assert.equal(s.liberoFor, 5);
    assert.equal(s.subs, 0);
  });

  test("con la rotazione manuale in P4 esce da solo", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 9, out: 5 } }), ev({ kind: "rotation", detail: { dir: 1 } })]);
    assert.ok(!s.rotation.includes(9));
    assert.equal(s.rotation[3], 5);
    assert.equal(s.liberoFor, null);
  });

  test("esce da solo anche con la rotazione del cambio palla", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), [ev({ kind: "libero", detail: { in: 9, out: 5 } }), ev({ point: "us" })]);
    assert.ok(!s.rotation.includes(9));
    assert.equal(s.rotation[3], 5);
  });

  test("resta in campo in seconda linea", () => {
    const ev = eventFactory();
    // Libero in P6: una rotazione lo porta in P5, ancora in seconda linea.
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 9, out: 6 } }), ev({ kind: "rotation", detail: { dir: 1 } })]);
    assert.equal(s.rotation[4], 9);
    assert.equal(s.liberoFor, 6);
  });

  test("esce a richiesta", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 9, out: 6 } }), ev({ kind: "libero", detail: { in: 6, out: 9 } })]);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(s.liberoFor, null);
  });

  test("a fine set torna in panchina", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 9, out: 6 } }), ...wonSet(ev)]);
    assert.ok(!s.rotation.includes(9));
    assert.ok(s.rotation.includes(6));
    assert.equal(s.liberoId, 9);
  });
});

describe("timeout e correzioni", () => {
  test("timeout contati per squadra e azzerati al set dopo", () => {
    const ev = eventFactory();
    const t = (side: "us" | "them") => ev({ kind: "timeout", detail: { side } });
    const s = live(lineup("us"), [t("us"), t("them"), t("us")]);
    assert.deepEqual(s.timeouts, { us: 2, them: 1 });
    const next = live(lineup("us"), [t("us"), ...wonSet(ev)]);
    assert.deepEqual(next.timeouts, { us: 0, them: 0 });
  });

  test("la correzione cambia il punteggio senza rotazione né battuta", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [
      ev({ point: "us" }),
      ev({ kind: "correction", point: "them", detail: { delta: 1 } }),
      ev({ kind: "correction", point: "us", detail: { delta: -1 } }),
    ]);
    assert.deepEqual(s.score, { us: 0, them: 1 });
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(s.serving, "us");
  });

  test("la correzione non scende sotto zero", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "correction", point: "them", detail: { delta: -1 } })]);
    assert.equal(s.score.them, 0);
  });
});
