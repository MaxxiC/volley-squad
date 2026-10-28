// Unione del registro del server con la copia locale del telefono (src/lib/live/merge.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeLogs, sameVersion } from "@/lib/live/merge";
import { eventFactory } from "./helpers";

const ev = eventFactory();

test("senza copia locale vale il server", () => {
  const a = ev({ point: "us" });
  const { events, toSend } = mergeLogs([a], []);
  assert.deepEqual([...events.values()], [a]);
  assert.deepEqual(toSend, []);
});

test("azione fatta offline e mai arrivata al server: si aggiunge e si reinvia", () => {
  const a = ev({ point: "us" });
  const offline = ev({ point: "them" });
  const { events, toSend } = mergeLogs([a], [{ event: offline, pending: true }]);
  assert.equal(events.size, 2);
  assert.deepEqual(toSend, [offline]);
});

test("versione locale da inviare vince su quella del server (es. annullata offline)", () => {
  const a = ev({ point: "us" });
  const undone = { ...a, deleted: true };
  const { events, toSend } = mergeLogs([a], [{ event: undone, pending: true }]);
  assert.equal(events.get(a.id)?.deleted, true);
  assert.deepEqual(toSend, [undone]);
});

test("pagina in cache più vecchia: gli eventi già inviati che mancano si tengono dalla copia locale", () => {
  const a = ev({ point: "us" });
  const synced = ev({ point: "us" });
  const { events, toSend } = mergeLogs([a], [{ event: synced, pending: false }]);
  assert.equal(events.size, 2);
  assert.deepEqual(toSend, []);
});

test("evento già inviato: vale la versione del server", () => {
  const a = ev({ point: "us", incomplete: true });
  const fromServer = { ...a, incomplete: false, skill: "attack" as const, outcome: "kill" };
  const { events } = mergeLogs([fromServer], [{ event: a, pending: false }]);
  assert.equal(events.get(a.id)?.skill, "attack");
});

test("sameVersion confronta il contenuto", () => {
  const a = ev({ point: "us" });
  assert.ok(sameVersion(a, { ...a }));
  assert.ok(!sameVersion(a, { ...a, star: true }));
});
