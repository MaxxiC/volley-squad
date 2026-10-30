// Validazione lato server del Live: eventi inviati all'API e "Inizia partita" di Prepara Live.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ResetLiveSchema, StartMatchSchema } from "@/app/admin/(staff)/live/prepare-schema";
import { sameName, type StartMatchInput } from "@/app/admin/(staff)/live/prepare-form";
import { EventBatchSchema, LiveEventSchema } from "@/lib/live/event-schema";
import { eventFactory } from "./helpers";

const ev = eventFactory();
const UUID = "4b0c8f8e-6a3d-4f7e-9d2a-1c2b3d4e5f60";
const valid = (o: Parameters<typeof ev>[0] = {}) => ev({ id: UUID, ...o });

describe("eventi del Live", () => {
  test("evento completo valido", () => {
    assert.ok(LiveEventSchema.safeParse(valid({ point: "us", skill: "attack", outcome: "kill", playerId: 4 })).success);
    assert.ok(LiveEventSchema.safeParse(valid({ kind: "lineup", detail: { slots: [1, 2, 3, 4, 5, 6], liberoId: null, serveFirst: "us" } })).success);
  });

  test("id non uuid rifiutato (serve all'upsert idempotente)", () => {
    assert.equal(LiveEventSchema.safeParse(valid({ id: "e1" })).success, false);
  });

  test("set fuori da 1–5 rifiutato", () => {
    assert.equal(LiveEventSchema.safeParse(valid({ setN: 6 })).success, false);
    assert.equal(LiveEventSchema.safeParse(valid({ setN: 0 })).success, false);
  });

  test("campi sconosciuti nel dettaglio rifiutati", () => {
    const bad = { ...valid(), detail: { ballType: "free", extra: 1 } };
    assert.equal(LiveEventSchema.safeParse(bad).success, false);
  });

  test("errore avversario: solo i tipi previsti", () => {
    assert.ok(LiveEventSchema.safeParse(valid({ point: "us", skill: "opp_error", detail: { oppError: "attack_net" } })).success);
    assert.equal(LiveEventSchema.safeParse({ ...valid({ point: "us", skill: "opp_error" }), detail: { oppError: "boh" } }).success, false);
  });

  test("formazione con meno di 6 giocatori rifiutata", () => {
    assert.equal(LiveEventSchema.safeParse(valid({ kind: "lineup", detail: { slots: [1, 2, 3] } })).success, false);
  });

  test("data senza fuso rifiutata", () => {
    assert.equal(LiveEventSchema.safeParse(valid({ createdAt: "2026-10-28 20:00" })).success, false);
  });

  test("lotto: almeno 1 evento, al massimo 500", () => {
    assert.equal(EventBatchSchema.safeParse({ events: [] }).success, false);
    assert.ok(EventBatchSchema.safeParse({ events: [valid()] }).success);
    assert.equal(EventBatchSchema.safeParse({ events: Array(501).fill(valid()) }).success, false);
  });
});

describe("Inizia partita", () => {
  const present = [1, 2, 3, 4, 5, 6, 7, 9].map((playerId) => ({ playerId, role: playerId === 9 ? ("L" as const) : ("S" as const) }));
  const base: StartMatchInput = { matchId: 1, present, slots: [1, 2, 3, 4, 5, 6], liberoId: 9, serveFirst: "us" };
  const errorOf = (o: Partial<StartMatchInput>) => {
    const r = StartMatchSchema.safeParse({ ...base, ...o });
    assert.equal(r.success, false, "doveva essere rifiutato");
    return r.error?.issues[0]?.message ?? "";
  };

  test("formazione valida", () => {
    assert.ok(StartMatchSchema.safeParse(base).success);
    assert.ok(StartMatchSchema.safeParse({ ...base, liberoId: null }).success);
  });

  test("almeno 6 presenti", () => {
    assert.match(errorOf({ present: present.slice(0, 5) }), /almeno 6/);
  });

  test("formazione incompleta", () => {
    assert.match(errorOf({ slots: [1, 2, 3, 4, 5] as unknown as number[] }), /6 giocatori/);
  });

  test("giocatore ripetuto in campo", () => {
    assert.match(errorOf({ slots: [1, 1, 3, 4, 5, 6] }), /due volte/);
  });

  test("in campo un non presente", () => {
    assert.match(errorOf({ slots: [1, 2, 3, 4, 5, 8] }), /non presente/);
  });

  test("libero anche in formazione", () => {
    assert.match(errorOf({ liberoId: 6 }), /libero non può essere anche in formazione/);
  });

  test("chi batte è obbligatorio", () => {
    assert.match(errorOf({ serveFirst: null as unknown as "us" }), /batte/);
  });
});

describe("Azzera il Live", () => {
  test("conferma con il nome dell'avversario: maiuscole e spazi in più non contano", () => {
    assert.ok(sameName("  test-VOLLEY ", "TEST-volley"));
    assert.ok(sameName("Ghedauto  Iveco Volley", "Ghedauto Iveco Volley"));
  });

  test("nome diverso o vuoto: niente azzeramento", () => {
    assert.ok(!sameName("TEST", "TEST-volley"));
    assert.ok(!sameName("", ""));
    assert.ok(!sameName("   ", "TEST-volley"));
  });

  test("la conferma è obbligatoria anche sul server", () => {
    assert.ok(ResetLiveSchema.safeParse({ matchId: 76, confirm: "TEST-volley" }).success);
    assert.ok(!ResetLiveSchema.safeParse({ matchId: 76, confirm: "  " }).success);
    assert.ok(!ResetLiveSchema.safeParse({ matchId: 0, confirm: "TEST-volley" }).success);
  });
});
