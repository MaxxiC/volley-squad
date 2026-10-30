// Fondamentali, esiti e scelte della modalità semplice (src/lib/live/skills.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OPP_ERRORS, SIMPLE_OUR_TYPES, SIMPLE_RALLY_TYPES, SIMPLE_THEIR_TYPES, isTeamFault, liberoCan, outcomeOf } from "@/lib/live/skills";

describe("modalità semplice", () => {
  test("ogni scelta è un fondamentale con un esito che esiste e dà il punto giusto", () => {
    for (const [types, point] of [
      [SIMPLE_OUR_TYPES, "us"],
      [SIMPLE_THEIR_TYPES, "them"],
    ] as const) {
      for (const t of types) {
        if (t.kind !== "skill") continue;
        assert.equal(outcomeOf(t.skill, t.outcome)?.point, point, t.label);
      }
    }
  });

  test("le azioni senza punto non danno punti", () => {
    for (const t of SIMPLE_RALLY_TYPES) {
      const o = outcomeOf(t.skill, t.outcome);
      assert.ok(o, t.label);
      assert.equal(o.point, null, t.label);
    }
  });

  test("ricezioni (anche del libero) e attacco giocato", () => {
    assert.deepEqual(
      SIMPLE_RALLY_TYPES.map((t) => [t.skill, t.outcome, Boolean(t.includeLibero)]),
      [
        ["reception", "good", true],
        ["reception", "poor", true],
        ["attack", "in", false],
      ],
    );
  });

  test("errori avversari: chiavi uniche, \"Altro\" in fondo", () => {
    const keys = OPP_ERRORS.map((o) => o.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(keys.at(-1), "other");
  });

  test("solo il fallo di posizione è di squadra", () => {
    assert.equal(isTeamFault("fault", "position"), true);
    assert.equal(isTeamFault("fault", "double"), false);
    assert.equal(isTeamFault("attack", "error"), false);
  });
});

describe("libero", () => {
  test("non batte e non mura; attacca solo come palla semplice, riceve, alza, fa falli", () => {
    assert.equal(liberoCan("serve"), false);
    assert.equal(liberoCan("block"), false);
    for (const s of ["attack", "reception", "set", "fault"] as const) assert.equal(liberoCan(s), true, s);
  });
});
