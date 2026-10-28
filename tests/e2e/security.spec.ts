// Controlli minimi di sicurezza del sito online: area staff chiusa senza accesso, API del Live
// protetta, intestazioni di sicurezza, niente indicizzazione dello staff, login che non rivela chi
// è registrato, limite ai tentativi, redirect solo interni, utente eliminato fuori subito. Nessun
// dato reale modificato (un utente temporaneo e i tentativi falliti dei test, tolti qui).
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { TOO_MANY_ATTEMPTS } from "@/lib/login-limit";
import { E2E_EMAIL, openDb } from "./db-snapshot";

const matchId = Number(process.env.E2E_MATCH_ID);
const password = () => process.env.E2E_PASSWORD ?? "";

async function fillLogin(page: import("@playwright/test").Page, email: string, pass: string, callbackUrl = "/admin/partite") {
  await page.goto(`/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", pass);
  await page.click("button[type=submit]");
}

test.describe("sicurezza", () => {
  test("senza accesso l'area staff porta al login e l'API del Live risponde 401", async ({ page, request }) => {
    for (const path of ["/admin", "/admin/partite", "/admin/partite/classifica", "/admin/giocatori", "/admin/live", `/admin/live/${matchId}`, "/admin/storico"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login/);
    }
    const res = await request.post(`/api/matches/${matchId}/events`, { data: { events: [] } });
    expect(res.status()).toBe(401);
  });

  test("intestazioni di sicurezza e area staff non indicizzata", async ({ page, request }) => {
    for (const path of ["/", "/calendario", "/admin/login"]) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(h["x-powered-by"], path).toBeUndefined();
    }
    await page.goto("/admin/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("login: stesso messaggio per email sconosciuta e password sbagliata, redirect solo interni", async ({ page }) => {
    await fillLogin(page, "nessuno@cusbros.local", "password-a-caso");
    await expect(page.getByText("Email o password non corretti.")).toBeVisible();
    await fillLogin(page, E2E_EMAIL, "password-sbagliata");
    await expect(page.getByText("Email o password non corretti.")).toBeVisible();

    await fillLogin(page, E2E_EMAIL, password(), "https://evil.example/admin/partite");
    await page.waitForURL(/\/admin\/partite$/, { timeout: 60_000 });
    expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL ?? "http://localhost:3001").host);
    // L'accesso riuscito toglie i tentativi falliti di E2E_EMAIL; quello dell'email sconosciuta si toglie qui.
    const { db, schema } = await openDb();
    await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, "nessuno@cusbros.local"));
  });

  test("dopo 5 errori con la stessa email l'accesso si blocca", async ({ page }) => {
    const email = "e2e-limite@cusbros.local";
    const { db, schema } = await openDb();
    try {
      for (let i = 0; i < 5; i++) {
        await fillLogin(page, email, `sbagliata-${i}`);
        await expect(page.getByText("Email o password non corretti.")).toBeVisible();
      }
      await fillLogin(page, email, "sbagliata-5");
      await expect(page.getByText(TOO_MANY_ATTEMPTS)).toBeVisible();
    } finally {
      await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));
    }
  });

  test("un utente eliminato perde subito l'accesso (anche con la sessione ancora valida)", async ({ page }) => {
    const email = "e2e-revocato@cusbros.local";
    const pass = randomBytes(18).toString("base64url");
    const { db, schema } = await openDb();
    execSync(`npm run user:create -- ${email} "Test revoca" coach`, { env: { ...process.env, NEW_USER_PASSWORD: pass }, stdio: "ignore" });
    try {
      await fillLogin(page, email, pass);
      await page.waitForURL(/\/admin\/partite$/, { timeout: 60_000 });

      await db.delete(schema.users).where(eq(schema.users.email, email));
      // Il token è ancora firmato e valido: il controllo sull'utente lo rimanda al login, senza giri infiniti.
      await page.goto("/admin/giocatori");
      await expect(page).toHaveURL(/\/admin\/login/);
      const res = await page.request.post(`/api/matches/${matchId}/events`, { data: { events: [] } });
      expect(res.status()).toBe(401);
    } finally {
      await db.delete(schema.users).where(eq(schema.users.email, email));
    }
  });
});
