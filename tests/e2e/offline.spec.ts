// Live senza rete, su una partita temporanea già in corso (global-setup.ts):
// azioni offline in coda → app chiusa senza rete → riapertura → sincronizzazione al ritorno della rete.
// Con la build di produzione (npm run build && npm start) verifica anche il service worker:
// la pagina del Live si riapre offline. In sviluppo il service worker non è attivo e la riapertura
// si fa con la rete già tornata.
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { TEAM_NAME } from "@/lib/club";
import { openDb } from "./db-snapshot";
import { login, saved, score, syncStatus } from "./helpers";

const matchId = Number(process.env.E2E_OFFLINE_MATCH_ID);
const livePath = `/admin/live/${matchId}`;

/** Punto nostro in modalità semplice, senza dettagli. */
async function pointUs(page: Page) {
  await page.getByRole("button", { name: new RegExp(`\\+1\\s*${TEAM_NAME}`, "i") }).click();
  await page.getByRole("button", { name: "Salta" }).click();
}

/** Il service worker controlla la pagina e ha salvato la pagina del Live? (false in sviluppo) */
async function liveCached(page: Page) {
  return page.evaluate(async (path) => {
    if (!(await navigator.serviceWorker?.getRegistration())) return false;
    for (let i = 0; i < 50; i++) {
      const cached = await caches.match(new URL(path, location.origin).href, { ignoreVary: true });
      if (cached) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }, livePath);
}

test("Live offline: coda su IndexedDB, chiusura dell'app, sincronizzazione", async ({ page, context }) => {
  expect(matchId, "partita temporanea creata da global-setup").toBeGreaterThan(0);
  const { db, schema: s } = await openDb();
  const savedEvents = async () => (await db.select().from(s.events).where(eq(s.events.matchId, matchId))).filter((e) => !e.deleted).length;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Richieste della pagina del Live fatte dal service worker e arrivate davvero in rete.
  const swReached: string[] = [];
  context.on("requestfinished", (r) => {
    if (r.serviceWorker() && new URL(r.url()).pathname === livePath) swReached.push(r.url());
  });

  await login(page, livePath);
  await expect(page.getByRole("region", { name: "Punteggio" })).toBeVisible({ timeout: 60_000 });
  await saved(page);
  // Aspetto che il service worker (se c'è) sia registrato prima di decidere.
  await page.waitForTimeout(1500);
  const withSw = await liveCached(page);
  test.info().annotations.push({
    type: "service worker",
    description: withSw ? "attivo: verificata la riapertura offline" : "non attivo (sviluppo): riapertura con la rete",
  });

  await test.step("tre punti senza rete restano in coda", async () => {
    await context.setOffline(true);
    for (let i = 0; i < 3; i++) await pointUs(page);
    expect(await score(page)).toMatchObject({ us: 3, them: 0 });
    await expect(syncStatus(page)).toHaveText("Offline · 3 azioni in coda");
    expect(await savedEvents()).toBe(0);
    // L'indicatore non deve allargare la pagina sul telefono più stretto.
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: test.info().outputPath("offline-320.png") });
  });

  // Chiudo l'app senza rete: le azioni devono essere sul telefono, non solo in memoria.
  await page.close();
  const again = await context.newPage();
  again.on("pageerror", (e) => errors.push(e.message));

  if (withSw) {
    await test.step("riapertura offline dalla cache del service worker", async () => {
      // Prova che la pagina arriva dalla cache: la richiesta del service worker alla rete non riesce.
      swReached.length = 0;
      await again.goto(livePath);
      await expect(again.getByRole("region", { name: "Punteggio" })).toBeVisible();
      expect(await score(again)).toMatchObject({ us: 3, them: 0 });
      await expect(syncStatus(again)).toHaveText("Offline · 3 azioni in coda");
      await pointUs(again);
      await expect(syncStatus(again)).toHaveText("Offline · 4 azioni in coda");
      expect(await savedEvents()).toBe(0);
      expect(swReached, "la pagina offline non deve arrivare dalla rete").toEqual([]);
    });
  }

  await test.step("ritorno della rete: tutto sincronizzato, senza doppioni", async () => {
    const expected = withSw ? 4 : 3;
    await context.setOffline(false);
    if (!withSw) await again.goto(livePath);
    await expect(again.getByRole("region", { name: "Punteggio" })).toBeVisible({ timeout: 60_000 });
    await saved(again);
    expect(await score(again)).toMatchObject({ us: expected, them: 0 });
    await expect.poll(savedEvents).toBe(expected);

    // Ricarico: dal server arrivano gli stessi eventi, niente si duplica e la coda è vuota.
    swReached.length = 0;
    await again.reload();
    await saved(again);
    expect(await score(again)).toMatchObject({ us: expected, them: 0 });
    expect(await savedEvents()).toBe(expected);
    // Controprova: online il service worker prende la pagina dalla rete (il controllo sopra è valido).
    if (withSw) expect(swReached.length).toBeGreaterThan(0);
  });

  expect(errors, "errori JavaScript nella pagina").toEqual([]);
});
