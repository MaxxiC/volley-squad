// Percorso completo del Live su una partita temporanea: Prepara Live → punti semplice/avanzato →
// Annulla/Ripeti e ricarica → cambi, libero, timeout, correzioni → 3 set → MVP → Concludi.
// Il DB viene copiato e ripristinato da global-setup.ts.
import { expect, test, type Page } from "@playwright/test";
import { and, asc, eq } from "drizzle-orm";
import { TEAM_NAME } from "@/lib/club";
import { playerLabel } from "@/lib/live/describe";
import { shortTeamName } from "@/lib/matches";
import { fullName, shortName } from "@/lib/players";
import { openDb } from "./db-snapshot";
import { esc, login, saved, score } from "./helpers";

const matchId = Number(process.env.E2E_MATCH_ID);
const opponentFull = process.env.E2E_OPPONENT ?? "";
const opponent = shortTeamName(opponentFull);

type P = { id: number; number: number; firstName: string; lastName: string; role: "P" | "S" | "O" | "C" | "L"; gender: "F" | "M" | null };
/** Bottone "numero + nome" (presenti, panchina, scelta del giocatore, MVP). */
const numbered = (p: P, name = shortName(p)) => new RegExp(`^${p.number}\\s*${esc(name)}`);

const feedTop = (page: Page) =>
  page.getByText("Ultime azioni", { exact: true }).locator("..").locator(":scope > div.grid").first();

const pos = (page: Page, n: number) => page.locator(`[aria-label^='P${n}:']`);

test("Live completo sul DB reale (con ripristino)", async ({ page }) => {
  expect(matchId, "partita temporanea creata da global-setup").toBeGreaterThan(0);
  const { db, schema: s } = await openDb();
  const roster: P[] = await db.query.players.findMany({ where: eq(s.players.active, true), orderBy: [asc(s.players.number)] });
  const byId = new Map(roster.map((p) => [p.id, p]));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("login e Prepara Live", async () => {
    await login(page, `/admin/live?partita=${matchId}`);
    await expect(page.getByRole("heading", { name: "Chi è presente?" })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("h1")).toContainText(opponentFull);

    // Tolgo un centrale e un opposto (restano ruoli sufficienti per "Riempi in ordine").
    const removed = [roster.findLast((p) => p.role === "C"), roster.findLast((p) => p.role === "O")].filter((p): p is P => Boolean(p));
    for (const p of removed) await page.getByRole("button", { name: numbered(p, fullName(p)) }).click();
    await expect(page.getByText(`${roster.length - removed.length}/${roster.length}`)).toBeVisible();

    // Ruolo di partita diverso dall'anagrafica.
    const changed = roster.find((p) => p.role === "O" && !removed.includes(p));
    if (changed) {
      await page.getByRole("button", { name: `Ruolo di ${fullName(changed)} in questa partita: Opposto` }).click();
      await page.getByRole("group", { name: `Ruolo di ${fullName(changed)}` }).getByRole("button", { name: "Banda" }).click();
      await expect(page.getByText("Banda (oggi)")).toBeVisible();
    }
    await page.getByRole("button", { name: /^Avanti · \d+ presenti/ }).click();

    await page.getByRole("button", { name: "Riempi in ordine" }).click();
    await page.getByRole("button", { name: "Avanti", exact: true }).click();

    await page.getByRole("button", { name: opponentFull, exact: true }).click();
    await page.getByRole("button", { name: /^Semplice/ }).click();
    await page.getByRole("button", { name: "Inizia partita" }).click();
    await page.waitForURL(new RegExp(`/admin/live/${matchId}$`), { timeout: 60_000 });

    const m = await db.query.matches.findFirst({ where: eq(s.matches.id, matchId) });
    expect(m?.status).toBe("live");
    const present = await db.select().from(s.matchPlayers).where(eq(s.matchPlayers.matchId, matchId));
    expect(present).toHaveLength(roster.length - removed.length);
    if (changed) expect(present.find((x) => x.playerId === changed.id)?.role).toBe("S");
  });

  const [lineup] = await db.select().from(s.lineups).where(and(eq(s.lineups.matchId, matchId), eq(s.lineups.setN, 1)));
  expect(lineup.serveFirst).toBe("them");
  const slots = [lineup.p1, lineup.p2, lineup.p3, lineup.p4, lineup.p5, lineup.p6];
  const present = await db.select().from(s.matchPlayers).where(eq(s.matchPlayers.matchId, matchId));
  const bench = present
    .filter((x) => !slots.includes(x.playerId) && x.playerId !== lineup.liberoId && x.role !== "L")
    .map((x) => byId.get(x.playerId) as P);
  const player = (id: number) => byId.get(id) as P;

  await test.step("modalità semplice: punto, rotazione, Salta", async () => {
    await expect(page.getByRole("region", { name: "Punteggio" })).toBeVisible({ timeout: 60_000 });
    expect(await score(page)).toEqual({ us: 0, them: 0, sets: "0–0" });

    await page.getByRole("button", { name: new RegExp(`\\+1\\s*${TEAM_NAME}`, "i") }).click();
    await page.getByRole("button", { name: "Attacco", exact: true }).click();
    const attacker = player(slots[3]);
    await page.getByRole("button", { name: numbered(attacker) }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 0 });
    await expect(feedTop(page)).toContainText(`Attacco punto · ${playerLabel(attacker)}`);
    // Cambio palla: si ruota, chi era in P2 va in battuta.
    await expect(pos(page, 1)).toHaveAttribute("aria-label", `P1: ${playerLabel(player(slots[1]))}, in battuta`);

    await page.getByRole("button", { name: new RegExp(`\\+1\\s*${esc(opponent)}`, "i") }).click();
    await page.getByRole("button", { name: "Salta" }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 1 });
    await expect(feedTop(page)).toContainText("da completare");
  });

  await test.step("Annulla / Ripeti e ricarica", async () => {
    await page.getByRole("button", { name: "↶ Annulla" }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 0 });
    await page.getByRole("button", { name: "↶ Annulla" }).click();
    await expect(feedTop(page)).toContainText(`Punto ${TEAM_NAME}`);
    await expect(feedTop(page)).toContainText("da completare");
    await page.getByRole("button", { name: "↷ Ripeti" }).click();
    await expect(feedTop(page)).toContainText("Attacco punto");
    await expect(page.getByRole("button", { name: "↷ Ripeti" })).toBeEnabled();

    await saved(page);
    await page.reload();
    await expect(page.getByRole("region", { name: "Punteggio" })).toBeVisible({ timeout: 60_000 });
    expect(await score(page)).toMatchObject({ us: 1, them: 0 });
    await expect(feedTop(page)).toContainText("Attacco punto");
  });

  await test.step("cambi: regolare e con avviso del rientro", async () => {
    const out = player(slots[2]); // dopo la rotazione è in P2
    await expect(pos(page, 2)).toHaveAttribute("aria-label", `P2: ${playerLabel(out)}`);
    await page.getByRole("button", { name: /^Cambio 0\/6/ }).click();
    await pos(page, 2).click();
    await page.getByRole("button", { name: numbered(bench[0]) }).click();
    await expect(page.getByRole("group", { name: "Ruolo di chi entra" }).getByRole("button", { pressed: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Conferma cambio" }).click();
    await expect(pos(page, 2)).toHaveAttribute("aria-label", `P2: ${playerLabel(bench[0])}`);
    await expect(page.getByRole("button", { name: /^Cambio 1\/6/ })).toBeVisible();
    await expect(feedTop(page)).toContainText(`Cambio · entra ${playerLabel(bench[0])}`);

    // Chi è entrato esce per un altro (non il titolare): avviso, poi rinuncio.
    await page.getByRole("button", { name: /^Cambio 1\/6/ }).click();
    await pos(page, 2).click();
    await page.getByRole("button", { name: numbered(bench[1]) }).click();
    await expect(page.getByRole("status").filter({ hasText: "titolare" })).toBeVisible();
    await page.getByRole("button", { name: "Annulla", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Cambio 1\/6/ })).toBeVisible();
  });

  await test.step("libero: entra in seconda linea, esce da solo in P4", async () => {
    await page.getByRole("button", { name: /Libero.*Fai entrare/ }).click();
    await pos(page, 5).click();
    await expect(pos(page, 5)).toHaveAttribute("aria-label", /\(libero\)/);
    await expect(page.getByText("Libero in campo")).toBeVisible();
    await page.getByRole("button", { name: "Ruota" }).click();
    await expect(page.locator("[aria-label*='(libero)']")).toHaveCount(0);
    await expect(page.getByText("Libero in campo")).toHaveCount(0);
  });

  await test.step("timeout e correzione del punteggio", async () => {
    const timeout = page.getByRole("button", { name: new RegExp(`^Timeout\\s*${TEAM_NAME}`, "i") });
    for (let i = 0; i < 3; i++) await timeout.click();
    await expect(timeout).toContainText("3/2");
    await expect(timeout).toHaveClass(/text-red/);

    await page.getByRole("button", { name: "Correggi" }).click();
    await page.getByRole("button", { name: `Aggiungi un punto a ${opponent}` }).click();
    await page.getByRole("button", { name: `Aggiungi un punto a ${opponent}` }).click();
    await page.getByRole("button", { name: `Togli un punto a ${opponent}` }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 1 });
    await expect(feedTop(page)).toContainText(`Correzione punteggio: −1 ${opponent}`);
    await page.getByRole("button", { name: "Fatto" }).click();
  });

  await test.step("modalità avanzata: azione senza punto", async () => {
    await page.getByRole("group", { name: "Modalità" }).getByRole("button", { name: "Avanzato" }).click();
    const label = await pos(page, 6).getAttribute("aria-label");
    await pos(page, 6).click();
    await page.getByRole("button", { name: "Ricezione", exact: true }).click();
    await page.getByRole("button", { name: /^Buona/ }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 1 });
    await expect(feedTop(page)).toContainText(`Ricezione buona · ${label?.replace(/^P6: /, "").replace(/ \(libero\)$/, "")}`);
  });

  await test.step("tre set vinti, MVP e chiusura", async () => {
    const winSet = async () => {
      const close = page.getByRole("button", { name: "Chiudi set" });
      for (let i = 0; i < 30 && !(await close.isVisible()); i++) {
        await page.getByRole("button", { name: new RegExp(`^Errore ${esc(opponent)}`, "i") }).click();
      }
      await close.click();
    };
    await winSet();
    await expect(page.getByText("Formazione set 2").first()).toBeVisible();
    await page.getByRole("button", { name: "Inizia set 2" }).click();
    expect(await score(page)).toEqual({ us: 0, them: 0, sets: "1–0" });
    await winSet();
    await page.getByRole("button", { name: "Inizia set 3" }).click();
    await winSet();
    await expect(page.getByText(/Partita vinta 3–0/)).toBeVisible();

    const mvp = player(slots[3]);
    await page.getByRole("button", { name: numbered(mvp) }).click();
    await saved(page);
    await page.getByRole("button", { name: "Concludi partita" }).click();
    await page.waitForURL(/\/admin\/partite$/, { timeout: 60_000 });

    const m = await db.query.matches.findFirst({ where: eq(s.matches.id, matchId), with: { sets: true } });
    expect(m?.status).toBe("finished");
    expect(m?.mvpPlayerId).toBe(mvp.id);
    expect(m?.sets.sort((a, b) => a.n - b.n).map((x) => `${x.us}-${x.them}`)).toEqual(["25-1", "25-0", "25-0"]);

    const events = await db.select().from(s.events).where(eq(s.events.matchId, matchId));
    expect(events.filter((e) => e.kind === "set_end" && !e.deleted)).toHaveLength(3);
    expect(events.filter((e) => e.deleted)).toHaveLength(1); // il punto loro annullato
  });

  await test.step("pagine pubbliche e controlli finali", async () => {
    await page.goto("/calendario");
    await expect(page.getByText(opponentFull).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "scroll orizzontale nel calendario").toBeLessThanOrEqual(0);
    expect(errors, "errori JavaScript nella pagina").toEqual([]);
  });
});
