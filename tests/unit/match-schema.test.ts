// Validazione del form partita (src/app/admin/(staff)/partite/match-schema.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MatchFormSchema } from "@/app/admin/(staff)/partite/match-schema";
import type { MatchFormInput, SetSlot } from "@/app/admin/(staff)/partite/match-form";

const empty: SetSlot = { us: "", them: "" };
const slot = (us: string, them: string): SetSlot => ({ us, them });
const sets = (...filled: SetSlot[]) => [...filled, ...Array(5 - filled.length).fill(empty)];

const base: MatchFormInput = {
  friendly: false,
  phase: "andata",
  round: "2",
  number: "8",
  home: true,
  opponent: "Dinamite",
  venue: "",
  date: "2026-11-01",
  time: "20:30",
  special: "none",
  slots: sets(),
};

function parse(o: Partial<MatchFormInput>) {
  return MatchFormSchema.safeParse({ ...base, ...o });
}

function errorOf(o: Partial<MatchFormInput>) {
  const r = parse(o);
  assert.equal(r.success, false, "doveva essere rifiutato");
  return r.error?.issues[0]?.message ?? "";
}

describe("amichevoli", () => {
  test("senza giornata né numero gara: giornata 0, niente numero, fase andata", () => {
    const r = parse({ friendly: true, phase: "ritorno", round: "", number: "12" });
    assert.ok(r.success);
    assert.equal(r.data.friendly, true);
    assert.equal(r.data.round, 0);
    assert.equal(r.data.number, null);
    assert.equal(r.data.phase, "andata");
  });

  test("in campionato la giornata resta obbligatoria", () => {
    assert.equal(errorOf({ round: "" }), "Inserisci la giornata (1–99)");
    assert.equal(errorOf({ round: "0" }), "Inserisci la giornata (1–99)");
  });
});

describe("campi della partita", () => {
  test("partita da giocare senza parziali", () => {
    const r = parse({});
    assert.ok(r.success);
    assert.deepEqual(r.data.sets, []);
    assert.equal(r.data.round, 2);
    assert.equal(r.data.number, 8);
  });

  test("numero gara facoltativo", () => {
    const r = parse({ number: "" });
    assert.ok(r.success);
    assert.equal(r.data.number, null);
  });

  test("data da definire (senza data né ora) è valida", () => {
    assert.ok(parse({ date: "", time: "" }).success);
  });

  test("data senza ora: errore", () => {
    assert.match(errorOf({ time: "" }), /ora/);
  });

  test("avversario obbligatorio (spazi non bastano)", () => {
    assert.match(errorOf({ opponent: "   " }), /avversario/);
  });

  test("giornata 1–99", () => {
    assert.match(errorOf({ round: "0" }), /giornata/);
    assert.match(errorOf({ round: "100" }), /giornata/);
  });
});

describe("parziali", () => {
  test("3–1 valido", () => {
    const r = parse({ slots: sets(slot("25", "20"), slot("20", "25"), slot("25", "10"), slot("25", "23")) });
    assert.ok(r.success);
    assert.equal(r.data.sets.length, 4);
    assert.deepEqual(r.data.sets[1], { us: 20, them: 25 });
  });

  test("set saltato", () => {
    assert.match(errorOf({ slots: [slot("25", "20"), empty, slot("25", "10"), empty, empty] }), /in ordine/);
  });

  test("pareggio", () => {
    assert.match(errorOf({ slots: sets(slot("25", "25")) }), /parità/);
  });

  test("punteggio incompleto", () => {
    assert.match(errorOf({ slots: sets(slot("25", "")) }), /entrambi/);
  });

  test("set dopo la fine della partita", () => {
    const four = sets(slot("25", "1"), slot("25", "1"), slot("25", "1"), slot("25", "1"));
    assert.match(errorOf({ slots: four }), /già finita 3–0/);
  });

  test("punteggio non numerico", () => {
    assert.match(errorOf({ slots: sets(slot("2a", "10")) }), /entrambi/);
  });
});

describe("situazioni particolari", () => {
  test("rinviata: i parziali inseriti vengono ignorati", () => {
    const r = parse({ special: "postponed", slots: sets(slot("25", "20")) });
    assert.ok(r.success);
    assert.deepEqual(r.data.sets, []);
  });

  test("vinta a tavolino: 3–0 d'ufficio", () => {
    const r = parse({ special: "forfeit_won" });
    assert.ok(r.success);
    assert.equal(r.data.sets.length, 3);
    assert.ok(r.data.sets.every((s) => s.us > s.them));
  });

  test("persa a tavolino: 0–3 d'ufficio", () => {
    const r = parse({ special: "forfeit_lost" });
    assert.ok(r.success);
    assert.ok(r.data.sets.every((s) => s.us < s.them));
  });
});
