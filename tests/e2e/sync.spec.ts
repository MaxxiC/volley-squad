// Invio degli eventi del Live quando qualcosa va storto, su una partita temporanea già in corso:
// coda lunga a blocchi, evento scartato dal server che non blocca gli altri, sessione scaduta,
// "Esci" che pulisce il telefono solo a coda vuota. Le risposte del server si simulano con page.route.
import { expect, test, type Page, type Route } from "@playwright/test";
import { eq } from "drizzle-orm";
import { TEAM_NAME } from "@/lib/club";
import { openDb } from "./db-snapshot";
import { login, saved, syncStatus } from "./helpers";

const matchId = Number(process.env.E2E_SYNC_MATCH_ID);
const livePath = `/admin/live/${matchId}`;
const API = `**/api/matches/${matchId}/events`;
type Sent = { id: string; seq: number; deleted: boolean };

/** Correzione +1 a noi: un evento per tocco (comodo per crearne tanti). */
const plusOne = (page: Page) => page.getByRole("button", { name: `Aggiungi un punto a ${TEAM_NAME}` }).click();

/** Righe della tabella `local-log` sul telefono. */
const localRows = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("cusbros-live");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("events")) return resolve(0);
          const count = db.transaction("events").objectStore("events").count();
          count.onsuccess = () => resolve(count.result);
        };
        req.onerror = () => resolve(-1);
      }),
  );

test("Live: invio a blocchi, evento scartato, sessione scaduta, Esci", async ({ page, context }) => {
  expect(matchId, "partita temporanea creata da global-setup").toBeGreaterThan(0);
  const { db, schema: s } = await openDb();
  const serverEvents = async () => db.select().from(s.events).where(eq(s.events.matchId, matchId));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await login(page, livePath);
  await expect(page.getByRole("region", { name: "Punteggio" })).toBeVisible({ timeout: 60_000 });
  await saved(page);
  await page.getByRole("button", { name: "Correggi" }).click();

  await test.step("coda lunga offline: si invia a blocchi da 100", async () => {
    const sizes: number[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes(`/api/matches/${matchId}/events`)) sizes.push((r.postDataJSON() as { events: Sent[] }).events.length);
    });
    await context.setOffline(true);
    for (let i = 0; i < 130; i++) await plusOne(page);
    await expect(syncStatus(page)).toHaveText("Offline · 130 azioni in coda");
    await context.setOffline(false);
    await saved(page);
    expect(await serverEvents()).toHaveLength(130);
    expect(Math.max(...sizes), "nessuna richiesta oltre 100 eventi").toBeLessThanOrEqual(100);
  });

  await test.step("evento scartato dal server: gli altri passano", async () => {
    const bad = 132; // il secondo dei prossimi tre
    const reject = async (route: Route) => {
      const body = route.request().postDataJSON() as { events: Sent[] };
      if (body.events.some((e) => e.seq === bad && !e.deleted)) {
        return route.fulfill({ status: 422, json: { error: "Evento con un giocatore non valido" } });
      }
      return route.continue();
    };
    await page.route(API, reject);
    for (let i = 0; i < 3; i++) await plusOne(page);
    await saved(page);
    await expect(page.getByRole("alert").filter({ hasText: "scartata" })).toHaveText(/1 azione scartata dal server \(Evento con un giocatore non valido\)/);
    const seqs = (await serverEvents()).map((e) => e.seq);
    expect(seqs).toContain(131);
    expect(seqs).toContain(133);
    expect(seqs).not.toContain(bad);

    // Annullando l'azione scartata la nuova versione (annullata) viene accettata e l'avviso sparisce.
    await page.getByRole("button", { name: "↶ Annulla" }).click();
    await page.getByRole("button", { name: "↶ Annulla" }).click();
    await saved(page);
    await expect(page.getByRole("alert").filter({ hasText: "scartata" })).toHaveCount(0);
    expect((await serverEvents()).find((e) => e.seq === bad)?.deleted).toBe(true);
    await page.unroute(API, reject);
  });

  await test.step("sessione scaduta: azioni in coda e link per rientrare", async () => {
    const expired = (route: Route) => route.fulfill({ status: 401, json: { error: "Non autorizzato" } });
    await page.route(API, expired);
    await plusOne(page);
    await expect(syncStatus(page)).toHaveText("Sessione scaduta · 1 azione in coda");
    await expect(page.getByRole("link", { name: "Rientra per inviarle →" })).toHaveAttribute(
      "href",
      `/admin/login?callbackUrl=${encodeURIComponent(livePath)}`,
    );
    await page.unroute(API, expired);
    // Nuovo tentativo automatico.
    await saved(page);
    await expect(page.getByRole("link", { name: "Rientra per inviarle →" })).toHaveCount(0);
  });

  await test.step("Esci con azioni in coda chiede conferma e non cancella nulla", async () => {
    const down = (route: Route) => route.fulfill({ status: 503, json: { error: "Servizio non disponibile" } });
    await page.route(API, down);
    await plusOne(page);
    await expect(syncStatus(page)).toHaveText(/Non salvato \(Servizio non disponibile\) · 1 azione in coda/);
    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Esci" }).click();
    await expect.poll(() => message).toContain("C'è 1 azione del Live non ancora inviata");
    await expect(page).toHaveURL(new RegExp(`${livePath}$`));
    expect(await localRows(page)).toBeGreaterThan(0);
    await page.unroute(API, down);
    await saved(page);
  });

  await test.step("Esci a coda vuota: copia locale e pagine salvate cancellate", async () => {
    // Con il service worker (produzione) la pagina deve essere in cache prima di uscire.
    if (await page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration()))) {
      await expect.poll(() => page.evaluate(async (path) => Boolean(await caches.match(new URL(path, location.origin).href, { ignoreVary: true })), livePath)).toBe(true);
    }
    let dialog = false;
    page.on("dialog", (d) => {
      dialog = true;
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Esci" }).click();
    await page.waitForURL(/\/admin\/login/, { timeout: 30_000 });
    expect(dialog, "nessuna conferma a coda vuota").toBe(false);
    expect(await localRows(page)).toBe(0);
    expect(await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("cusbros-pages-")))).toEqual([]);
  });

  expect(errors, "errori JavaScript nella pagina").toEqual([]);
});
