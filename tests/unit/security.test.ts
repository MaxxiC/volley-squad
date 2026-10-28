// Sicurezza: redirect dopo il login solo verso l'area staff (src/app/admin/login/safe-redirect.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { safeRedirect } from "@/app/admin/login/safe-redirect";

describe("redirect dopo il login", () => {
  test("percorsi interni all'area staff: ammessi, con i parametri", () => {
    assert.equal(safeRedirect("/admin/live/12"), "/admin/live/12");
    assert.equal(safeRedirect("/admin/storico?partita=3"), "/admin/storico?partita=3");
  });

  test("altri siti, sito pubblico o login: si va all'area staff", () => {
    for (const bad of ["https://evil.example/admin/x", "//evil.example/admin/x", "/\evil.example/admin", "/", "/calendario", "/admin/login", "javascript:alert(1)", ""]) {
      assert.equal(safeRedirect(bad), "/admin/partite", bad);
    }
    assert.equal(safeRedirect(null), "/admin/partite");
  });
});
