// Date in Europe/Rome (src/lib/format.ts) e formazione automatica (src/lib/lineup.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fromRomeInput, toDateInput, toTimeInput } from "@/lib/format";
import { fillInOrder, groupByRole, roleMismatches, suggestedRoles, womenOnCourt } from "@/lib/lineup";

describe("fromRomeInput", () => {
  const cases: [string, string, string][] = [
    ["2026-10-31", "21:00", "2026-10-31T20:00:00.000Z"], // ora solare
    ["2026-10-11", "20:30", "2026-10-11T18:30:00.000Z"], // ora legale
    ["2027-03-28", "20:30", "2027-03-28T18:30:00.000Z"], // giorno del passaggio all'ora legale
    ["2026-12-31", "23:30", "2026-12-31T22:30:00.000Z"], // cambia il giorno in UTC
  ];
  for (const [date, time, iso] of cases) {
    test(`${date} ${time} → ${iso}`, () => {
      const got = fromRomeInput(date, time);
      assert.equal(got.toISOString(), iso);
      assert.equal(toDateInput(got), date);
      assert.equal(toTimeInput(got), time);
    });
  }
});

describe("fillInOrder", () => {
  // Ruoli di partita: alzatore, 2 bande, 2 centrali, opposto, libero, più un'altra banda.
  const present = [
    { id: 10, role: "S" as const },
    { id: 11, role: "C" as const },
    { id: 12, role: "P" as const },
    { id: 13, role: "L" as const },
    { id: 14, role: "O" as const },
    { id: 15, role: "S" as const },
    { id: 16, role: "C" as const },
    { id: 17, role: "S" as const },
  ];

  test("riempie seguendo P, S, C, O, S, C e sceglie il libero", () => {
    const r = fillInOrder([null, null, null, null, null, null], null, present);
    assert.deepEqual(r.slots, [12, 10, 11, 14, 15, 16]);
    assert.equal(r.libero, 13);
  });

  test("non tocca le posizioni già piene né il libero scelto", () => {
    const r = fillInOrder([17, null, null, null, null, null], 13, present);
    assert.equal(r.slots[0], 17);
    assert.equal(r.libero, 13);
    assert.equal(new Set(r.slots).size, 6);
  });

  test("se manca il ruolo usa chiunque tranne il libero", () => {
    const few = [
      { id: 1, role: "S" as const },
      { id: 2, role: "S" as const },
      { id: 3, role: "S" as const },
      { id: 4, role: "S" as const },
      { id: 5, role: "S" as const },
      { id: 6, role: "S" as const },
      { id: 7, role: "L" as const },
    ];
    const r = fillInOrder([null, null, null, null, null, null], null, few);
    assert.ok(!r.slots.includes(7));
    assert.ok(r.slots.every((x) => x !== null));
  });
});

describe("roleMismatches", () => {
  const roles: Record<number, "P" | "S" | "C" | "O"> = { 12: "P", 4: "S", 14: "C", 6: "O", 5: "C", 11: "C", 7: "S" };
  const roleOf = (id: number) => roles[id];

  test("centrale al posto della banda (alzatore in P1)", () => {
    // P1..P6 = 12 P, 4 S, 14 C, 6 O, 5 C, 11 C: il 5 in P5 è al posto della banda.
    assert.deepEqual([...roleMismatches([12, 4, 14, 6, 5, 11], roleOf)], [[5, "S"]]);
  });

  test("schema seguito: nessuna proposta, anche con l'alzatore in un altro posto", () => {
    assert.equal(roleMismatches([12, 4, 14, 6, 7, 11], roleOf).size, 0);
    // Alzatore in P3: P3 P, P4 S, P5 C, P6 O, P1 S, P2 C.
    assert.equal(roleMismatches([7, 11, 12, 4, 14, 6], roleOf).size, 0);
  });

  test("formazione incompleta o senza un solo alzatore: nessuna proposta", () => {
    assert.equal(roleMismatches([12, 4, 14, 6, 5, null], roleOf).size, 0);
    assert.equal(roleMismatches([7, 4, 14, 6, 5, 11], roleOf).size, 0);
  });
});

describe("womenOnCourt", () => {
  test("avvisa sotto le 2 donne e conta i sessi non indicati", () => {
    const g = { 1: "F", 2: "M", 3: null } as const;
    const r = womenOnCourt([1, 2, 3], (id) => g[id as 1 | 2 | 3]);
    assert.deepEqual(r, { women: 1, unknown: 1, warn: true });
    assert.equal(womenOnCourt([1, 1], () => "F").warn, false);
  });
});

describe("suggestedRoles", () => {
  const roles: Record<number, "P" | "S" | "C" | "O" | "L"> = { 1: "P", 2: "S", 3: "C", 4: "O", 5: "S", 6: "C", 7: "L" };
  const roleOf = (id: number) => roles[id];
  const empty = [null, null, null, null, null, null];

  test("campo vuoto: schema con l'alzatore in P1", () => {
    assert.deepEqual(suggestedRoles(empty, roleOf), [["P"], ["S"], ["C"], ["O"], ["S"], ["C"]]);
  });

  test("alzatore in P1: in P4 l'opposto, bande in P2 e P5, centrali in P3 e P6", () => {
    assert.deepEqual(suggestedRoles([1, null, null, null, null, null], roleOf), [["P"], ["S"], ["C"], ["O"], ["S"], ["C"]]);
  });

  test("alzatore in P3: lo schema gira con lui", () => {
    assert.deepEqual(suggestedRoles([null, null, 1, null, null, null], roleOf), [["S"], ["C"], ["P"], ["S"], ["C"], ["O"]]);
  });

  test("solo una banda in P2: alzatore o opposto in P1 e P4", () => {
    const r = suggestedRoles([null, 2, null, null, null, null], roleOf);
    assert.deepEqual(r.map((x) => [...x].sort()), [["O", "P"], ["S"], ["C"], ["O", "P"], ["S"], ["C"]]);
  });

  test("il libero non conta", () => {
    assert.deepEqual(suggestedRoles([7, null, null, null, null, null], roleOf), suggestedRoles(empty, roleOf));
  });
});

describe("groupByRole", () => {
  const players = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
  const roles: Record<number, "P" | "S" | "C" | "O" | "L"> = { 1: "C", 2: "S", 3: "P", 4: "S", 5: "L" };

  test("gruppi nell'ordine dei ruoli, chi non ha giocatori non c'è", () => {
    const g = groupByRole(players, (id) => roles[id]);
    assert.deepEqual(g.map((x) => [x.role, x.players.map((p) => p.id)]), [["P", [3]], ["S", [2, 4]], ["C", [1]], ["L", [5]]]);
  });

  test("ruolo consigliato per primo", () => {
    const g = groupByRole(players, (id) => roles[id], ["C"]);
    assert.deepEqual(g.map((x) => x.role), ["C", "P", "S", "L"]);
    assert.deepEqual(g.map((x) => x.preferred), [true, false, false, false]);
  });
});

describe("fillInOrder con lo schema che gira", () => {
  test("alzatore già in P3: il secondo alzatore non va in P1, le posizioni seguono lo schema", () => {
    const present = [
      { id: 1, role: "P" as const },
      { id: 2, role: "P" as const },
      { id: 3, role: "S" as const },
      { id: 4, role: "S" as const },
      { id: 5, role: "C" as const },
      { id: 6, role: "C" as const },
      { id: 7, role: "O" as const },
      { id: 8, role: "L" as const },
    ];
    const r = fillInOrder([null, null, 1, null, null, null], null, present);
    // P1 S, P2 C, P3 P, P4 S, P5 C, P6 O.
    assert.deepEqual(r.slots, [3, 5, 1, 4, 6, 7]);
    assert.equal(r.libero, 8);
  });
});
