// Storico live: modifica delle azioni, punteggio ricalcolato, posizione delle azioni aggiunte (src/lib/live/storico.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeLive } from "@/lib/live/state";
import { applyEdit, isDeletable, isEditable, defaultOutcome, editIssue, editOf, finishedIssue, insertSeq, pointOf, setRows, setsOf } from "@/lib/live/storico";
import { eventFactory, lineup, points, wonSet } from "./helpers";

describe("modifica di un'azione", () => {
  test("il punto si ricava da fondamentale ed esito", () => {
    assert.equal(pointOf({ skill: "attack", outcome: "kill", playerId: 4, star: false }, null), "us");
    assert.equal(pointOf({ skill: "attack", outcome: "blocked", playerId: 4, star: false }, "us"), "them");
    assert.equal(pointOf({ skill: "reception", outcome: "good", playerId: 4, star: false }, "us"), null);
    assert.equal(pointOf({ skill: "opp_error", outcome: "free", playerId: null, star: false }, null), "us");
    assert.equal(pointOf({ skill: "opp_point", outcome: null, playerId: null, star: false }, null), "them");
    // Ancora da completare: resta il punto segnato nel Live.
    assert.equal(pointOf({ skill: null, outcome: null, playerId: null, star: false }, "them"), "them");
  });

  test("un punto \"da completare\" diventa un attacco punto del giocatore", () => {
    const ev = eventFactory();
    const e = ev({ point: "us", incomplete: true });
    const next = applyEdit(e, { skill: "attack", outcome: "kill", playerId: 4, star: true });
    assert.equal(next.incomplete, false);
    assert.equal(next.point, "us");
    assert.equal(next.playerId, 4);
    assert.equal(next.star, true);
    assert.equal(next.id, e.id);
    assert.equal(next.seq, e.seq);
  });

  test("senza giocatore un nostro fondamentale resta da completare; l'avversario non lo chiede", () => {
    const ev = eventFactory();
    assert.equal(applyEdit(ev({ point: "us" }), { skill: "serve", outcome: "ace", playerId: null, star: false }).incomplete, true);
    const opp = applyEdit(ev({ point: "us", playerId: 4 }), { skill: "opp_error", outcome: "serve", playerId: 4, star: false });
    assert.equal(opp.incomplete, false);
    assert.equal(opp.playerId, null);
    assert.deepEqual(opp.detail, { oppError: "serve" });
  });

  test("fallo di posizione: di squadra, senza giocatore ma completo", () => {
    const ev = eventFactory();
    const e = applyEdit(ev({ point: "them", playerId: 4 }), { skill: "fault", outcome: "position", playerId: 4, star: false });
    assert.equal(e.playerId, null);
    assert.equal(e.incomplete, false);
    assert.equal(e.point, "them");
    // Un altro fallo invece vuole il giocatore.
    assert.equal(applyEdit(ev({ point: "them" }), { skill: "fault", outcome: "double", playerId: null, star: false }).incomplete, true);
  });

  test("valori del form e coerenza dell'esito", () => {
    const ev = eventFactory();
    assert.deepEqual(editOf(ev({ skill: "opp_error", point: "us", detail: { oppError: "attack_out" } })), {
      skill: "opp_error",
      outcome: "attack_out",
      playerId: null,
      star: false,
    });
    // Partite registrate prima del tipo di errore: "Altro".
    assert.equal(editOf(ev({ skill: "opp_error", point: "us", detail: { ballType: "rally" } })).outcome, "other");
    assert.equal(editIssue({ skill: "opp_error", outcome: "rally", playerId: null, star: false }), "Esito non valido per questo fondamentale");
    assert.equal(editIssue({ skill: "attack", outcome: "ace", playerId: 4, star: false }), "Esito non valido per questo fondamentale");
    assert.equal(editIssue({ skill: "opp_point", outcome: null, playerId: null, star: false }), null);
  });

  test("esito proposto: se possibile con lo stesso punto", () => {
    assert.equal(defaultOutcome("attack", "us"), "kill");
    assert.equal(defaultOutcome("attack", "them"), "blocked");
    assert.equal(defaultOutcome("reception", "us"), "perfect", "nessun esito di punto nostro: il primo");
    assert.equal(defaultOutcome("opp_point", "them"), null);
  });
});

describe("righe di un set e punteggio ricalcolato", () => {
  test("punteggio dopo ogni azione, per set", () => {
    const ev = eventFactory();
    const events = [...points(ev, "us", 2), ...wonSet(ev), ev({ setN: 2, point: "them" }), ev({ setN: 2, kind: "timeout", detail: { side: "us" } })];
    const set1 = setRows(lineup("us"), events, 1);
    assert.equal(set1.length, 27, "2 punti + 25 del set vinto, senza la chiusura");
    assert.deepEqual(set1[1].score, { us: 2, them: 0 });
    const set2 = setRows(lineup("us"), events, 2);
    assert.deepEqual(set2.map((r) => r.score), [{ us: 0, them: 1 }, { us: 0, them: 1 }]);
    assert.deepEqual(setsOf(events), [1, 2]);
  });

  test("cambiare chi fa punto ricalcola il set", () => {
    const ev = eventFactory();
    const e = ev({ point: "us", skill: "attack", outcome: "kill", playerId: 4 });
    const events = [e, ev({ point: "us" })];
    const edited = events.map((x) => (x.id === e.id ? applyEdit(x, { skill: "attack", outcome: "error", playerId: 4, star: false }) : x));
    assert.deepEqual(computeLive(lineup("us"), edited)?.score, { us: 1, them: 1 });
  });
});

describe("azione aggiunta", () => {
  test("dopo un'azione o in fondo al set, prima della sua chiusura", () => {
    const ev = eventFactory();
    const events = [ev({ point: "us" }), ev({ point: "us" }), ev({ kind: "set_end" }), ev({ setN: 2, point: "them" })];
    assert.equal(insertSeq(events, 1, events[0].id), 2);
    assert.equal(insertSeq(events, 1, null), 3, "al posto della chiusura, che si sposta di 1");
    assert.equal(insertSeq(events, 2, null), 5, "ultimo set senza chiusura: in fondo");
  });
});

describe("partita ancora valida dopo una correzione", () => {
  const match = (ev: ReturnType<typeof eventFactory>) => [...wonSet(ev), ...wonSet(ev), ...wonSet(ev)];

  test("3–0 intatto: nessun problema", () => {
    assert.equal(finishedIssue(computeLive(lineup("us"), match(eventFactory()))), null);
  });

  test("un punto tolto lascia il set a 24–0: rifiutata", () => {
    const events = match(eventFactory());
    const next = events.map((e, i) => (i === 0 ? { ...e, deleted: true } : e));
    assert.match(finishedIssue(computeLive(lineup("us"), next)) ?? "", /il set 1 finirebbe 24–0, che non è un punteggio di fine set/);
  });

  test("partita non più finita: rifiutata", () => {
    const events = match(eventFactory());
    const lastEnd = events.findLast((e) => e.kind === "set_end")!;
    const next = events.map((e) => (e.id === lastEnd.id ? { ...e, deleted: true } : e));
    assert.match(finishedIssue(computeLive(lineup("us"), next)) ?? "", /non risulterebbe più finita/);
  });
});

describe("scambio di posto nello Storico", () => {
  test("si può eliminare, non modificare", () => {
    const ev = eventFactory();
    const swap = ev({ kind: "swap", detail: { in: 2, out: 3 } });
    assert.equal(isDeletable(swap), true);
    assert.equal(isEditable(swap), false);
  });
});
