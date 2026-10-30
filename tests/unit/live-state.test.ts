// Stato del Live ricostruito dal registro eventi (src/lib/live/state.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeLive, lastTimeout, liberoTarget, rotateClockwise, rotationWithoutLibero, setWinnerOf, subWarning, type LiveState } from "@/lib/live/state";
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

  test("cambio di libero in panchina (A ↔ B): nessun cambio consumato", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 19, out: 9 } })]);
    assert.equal(s.liberoId, 19);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(s.subs, 0);
  });

  test("cambio di libero in campo: il nuovo resta al posto dello stesso giocatore", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 9, out: 5 } }), ev({ kind: "libero", detail: { in: 19, out: 9 } })]);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 19, 6]);
    assert.equal(s.liberoId, 19);
    assert.equal(s.liberoFor, 5);
    assert.equal(s.subs, 0);
    // E poi esce: rientra il giocatore sostituito.
    const out = live(lineup("us"), [
      ev({ kind: "libero", detail: { in: 9, out: 5 } }),
      ev({ kind: "libero", detail: { in: 19, out: 9 } }),
      ev({ kind: "libero", detail: { in: 5, out: 19 } }),
    ]);
    assert.deepEqual(out.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(out.liberoFor, null);
    assert.equal(out.liberoId, 19);
  });

  test("libero scelto a set iniziato se il posto era vuoto", () => {
    const ev = eventFactory();
    const s = live(lineup("us", { liberoId: null }), [ev({ point: "us" }), ev({ kind: "libero", detail: { in: 9 } })]);
    assert.equal(s.liberoId, 9);
    assert.equal(s.liberoFor, null);
    assert.equal(s.subs, 0);
  });

  test("scorciatoia: il libero entra per il centrale in seconda linea", () => {
    const ev = eventFactory();
    const roles: Record<number, "C" | "S"> = { 3: "C", 6: "C" };
    const roleOf = (id: number) => roles[id] ?? "S";
    // Battono loro, P1..P6 = 1..6: il centrale 6 è in P6.
    assert.equal(liberoTarget(live(lineup("them"), []), roleOf), 6);
    // Dopo due rotazioni il centrale 3 è in P1 e il 6 in P4 (prima linea).
    const rotated = live(lineup("them"), [ev({ kind: "rotation", detail: { dir: 1 } }), ev({ kind: "rotation", detail: { dir: 1 } })]);
    assert.deepEqual(rotated.rotation, [3, 4, 5, 6, 1, 2]);
    assert.equal(liberoTarget(rotated, roleOf), 3, "in P1 se batte l'avversario");
    assert.equal(liberoTarget({ ...rotated, serving: "us" }, roleOf), null, "non al posto di chi sta per battere");
    // Libero già in campo o non designato: nessuna proposta.
    const onCourt = live(lineup("them"), [ev({ kind: "libero", detail: { in: 9, out: 6 } })]);
    assert.equal(liberoTarget(onCourt, roleOf), null);
    assert.equal(liberoTarget(live(lineup("them", { liberoId: null }), []), roleOf), null);
  });

  test("a fine set torna in panchina", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "libero", detail: { in: 9, out: 6 } }), ...wonSet(ev)]);
    assert.ok(!s.rotation.includes(9));
    assert.ok(s.rotation.includes(6));
    assert.equal(s.liberoId, 9);
  });
});

describe("libero automatico sui centrali", () => {
  // P1..P6 = 1..6: i centrali sono 3 (P3) e 6 (P6), uno di fronte all'altro.
  const role = (id: number) => (id === 3 || id === 6 ? "C" : "S") as "C" | "S";

  test("senza i ruoli non entra da solo", () => {
    const s = live(lineup("them"), []);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(s.liberoFor, null);
  });

  test("entra subito per il centrale in seconda linea", () => {
    const s = live(lineup("them"), [], role);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 9]);
    assert.equal(s.liberoFor, 6);
    assert.equal(s.subs, 0);
  });

  test("si alterna sui due centrali: esce in P4, entra per l'altro quando perdiamo la battuta", () => {
    const ev = eventFactory();
    const base = [ev({ point: "us" }), ev({ point: "them" }), ev({ point: "us" })];
    // Due cambi palla: il libero arriva in P4 ed esce, il 3 è in P1 e batte.
    const out = live(lineup("them"), base, role);
    assert.deepEqual(out.rotation, [3, 4, 5, 6, 1, 2]);
    assert.equal(out.liberoFor, null);
    // Perdiamo la battuta: il libero entra per il 3 in P1.
    const back = live(lineup("them"), [...base, ev({ point: "them" })], role);
    assert.deepEqual(back.rotation, [9, 4, 5, 6, 1, 2]);
    assert.equal(back.liberoFor, 3);
    assert.equal(back.subs, 0);
  });

  test("fatto uscire a mano non rientra finché il centrale è in seconda linea", () => {
    const ev = eventFactory();
    const manual = [ev({ kind: "libero", detail: { in: 6, out: 9 } }), ev({ point: "them" }), ev({ point: "us" })];
    const s = live(lineup("them"), manual, role);
    assert.deepEqual(s.rotation, [2, 3, 4, 5, 6, 1], "il 6 è in P5, il libero resta fuori");
    assert.equal(s.liberoSkip, 6);
    // Il 6 va in prima linea: si torna all'automatico, e quando perdiamo la battuta entra per il 3.
    const later = live(lineup("them"), [...manual, ev({ point: "them" }), ev({ point: "us" }), ev({ point: "them" })], role);
    assert.deepEqual(later.rotation, [9, 4, 5, 6, 1, 2]);
    assert.equal(later.liberoSkip, null);
    // A mano può sempre rientrare.
    const again = live(lineup("them"), [...manual, ev({ kind: "libero", detail: { in: 9, out: 6 } })], role);
    assert.equal(again.rotation[4], 9);
    assert.equal(again.liberoSkip, null);
  });

  test("al set dopo la formazione proposta è senza libero", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), wonSet(ev, "them"), role);
    assert.equal(s.setN, 2);
    assert.ok(s.rotation.includes(9), "nel set nuovo il libero rientra da solo");
    assert.ok(!rotationWithoutLibero(s).includes(9));
    assert.equal(rotationWithoutLibero(s).filter((id) => id === 3 || id === 6).length, 2);
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

describe("scambio di posto e timeout −1", () => {
  test("lo scambio inverte due posizioni, non conta come cambio e non tocca punteggio né battuta", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ point: "us" }), ev({ kind: "swap", detail: { in: 2, out: 3 } })]);
    assert.deepEqual(s.rotation, [1, 3, 2, 4, 5, 6]);
    assert.equal(s.subs, 0);
    assert.deepEqual(s.score, { us: 1, them: 0 });
    assert.equal(s.serving, "us");
  });

  test("la rotazione dopo lo scambio parte dalle nuove posizioni", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), [ev({ kind: "swap", detail: { in: 1, out: 2 } }), ev({ point: "us" })]);
    // Prima [2, 1, 3, 4, 5, 6], poi cambio palla: ruota.
    assert.deepEqual(s.rotation, [1, 3, 4, 5, 6, 2]);
  });

  test("scambio con un giocatore non in campo o annullato: nessun effetto", () => {
    const ev = eventFactory();
    assert.deepEqual(live(lineup("us"), [ev({ kind: "swap", detail: { in: 2, out: 7 } })]).rotation, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(live(lineup("us"), [ev({ kind: "swap", detail: { in: 2, out: 3 }, deleted: true })]).rotation, [1, 2, 3, 4, 5, 6]);
  });

  test("lastTimeout: l'ultimo valido di quella squadra in quel set", () => {
    const ev = eventFactory();
    const t = (side: "us" | "them", o = {}) => ev({ kind: "timeout", detail: { side }, ...o });
    const events = [t("us"), t("us"), t("them"), t("us", { deleted: true }), t("us", { setN: 2 })];
    assert.equal(lastTimeout(events, 1, "us")?.id, "e2");
    assert.equal(lastTimeout(events, 1, "them")?.id, "e3");
    assert.equal(lastTimeout(events, 3, "us"), null);
  });
});

describe("registro corretto dallo Storico (trovati dai test a caso)", () => {
  // Lineup: P1..P6 = 1..6, libero 9. Il libero entra per il 6 (P6, seconda linea).
  test("uscita del libero che indica un giocatore già in campo: rientra chi il libero sostituisce", () => {
    const ev = eventFactory();
    const s = live(lineup("them"), [ev({ kind: "libero", detail: { in: 9, out: 6 } }), ev({ kind: "libero", detail: { in: 2, out: 9 } })]);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(s.liberoFor, null);
  });

  test("cambio che non torna più (entra chi è già in campo, o esce chi non c'è): si salta", () => {
    const ev = eventFactory();
    const s = live(lineup("us"), [ev({ kind: "sub", detail: { out: 1, in: 2, role: "S" } }), ev({ kind: "sub", detail: { out: 8, in: 7, role: "S" } })]);
    assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
    assert.equal(s.subs, 0);
  });

  test("il libero entra solo per un giocatore di seconda linea e mai due volte", () => {
    const ev = eventFactory();
    assert.deepEqual(live(lineup("them"), [ev({ kind: "libero", detail: { in: 9, out: 3 } })]).rotation, [1, 2, 3, 4, 5, 6]);
    const twice = live(lineup("them"), [ev({ kind: "libero", detail: { in: 9, out: 6 } }), ev({ kind: "libero", detail: { in: 9, out: 5 } })]);
    assert.deepEqual(twice.rotation, [1, 2, 3, 4, 5, 9]);
  });
});

test("uscita del libero quando è già in panchina: nessun giocatore in campo diventa libero", () => {
  const ev = eventFactory();
  const s = live(lineup("them"), [ev({ kind: "libero", detail: { in: 5, out: 9 } })]);
  assert.equal(s.liberoId, 9);
  assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 6]);
});

test("cambio del giocatore sostituito dal libero: chi entra prende il suo posto dietro al libero", () => {
  const ev = eventFactory();
  const s = live(lineup("them"), [ev({ kind: "libero", detail: { in: 9, out: 6 } }), ev({ kind: "sub", detail: { out: 6, in: 7, role: "C" } })]);
  assert.deepEqual(s.rotation, [1, 2, 3, 4, 5, 9]);
  assert.equal(s.liberoFor, 7);
  assert.equal(s.subs, 1);
  // All'uscita del libero rientra chi è entrato col cambio.
  const out = live(lineup("them"), [
    ev({ kind: "libero", detail: { in: 9, out: 6 } }),
    ev({ kind: "sub", detail: { out: 6, in: 7, role: "C" } }),
    ev({ kind: "libero", detail: { in: 7, out: 9 } }),
  ]);
  assert.deepEqual(out.rotation, [1, 2, 3, 4, 5, 7]);
});
