// Limite ai tentativi di accesso (src/lib/login-limit.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clientIp, loginBlocked } from "@/lib/login-limit";

describe("limite ai tentativi di accesso", () => {
  test("5 errori della stessa email dalla stessa connessione bloccano", () => {
    assert.equal(loginBlocked({ emailIp: 4, ip: 4, email: 4 }), false);
    assert.equal(loginBlocked({ emailIp: 5, ip: 5, email: 5 }), true);
  });

  test("tante email dalla stessa connessione: blocco a 20", () => {
    assert.equal(loginBlocked({ emailIp: 1, ip: 19, email: 1 }), false);
    assert.equal(loginBlocked({ emailIp: 1, ip: 20, email: 1 }), true);
  });

  test("stessa email da tante connessioni: blocco solo a 50 (non si blocca il proprietario con pochi tentativi)", () => {
    assert.equal(loginBlocked({ emailIp: 0, ip: 0, email: 49 }), false);
    assert.equal(loginBlocked({ emailIp: 0, ip: 0, email: 50 }), true);
  });

  test("connessione: primo indirizzo di x-forwarded-for, poi x-real-ip", () => {
    assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
    assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
    assert.equal(clientIp(new Headers()), "sconosciuto");
  });
});
