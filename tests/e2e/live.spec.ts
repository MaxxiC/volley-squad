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

    // La pila sopravvive al ricaricamento: Ripeti rimette il punto loro, Annulla lo toglie di nuovo.
    await page.getByRole("button", { name: "↷ Ripeti" }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 1 });
    await page.getByRole("button", { name: "↶ Annulla" }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 0 });
    await saved(page);

    // Senza la pila salvata (dati del telefono cancellati) si ricostruisce dal registro.
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cusbros:undo:")).forEach((k) => localStorage.removeItem(k)));
    await page.reload();
    await expect(page.getByRole("region", { name: "Punteggio" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "↶ Annulla" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "↷ Ripeti" })).toBeDisabled();
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

  await test.step("libero: automatico sul centrale, uscita e rientro a mano, cambio A ↔ B, esce da solo in P4", async () => {
    // "Riempi in ordine" (P S C O S C): il centrale in P6 all'inizio, in P5 dopo la rotazione, ha già il libero al suo posto.
    const centrale = player(slots[5]);
    await expect(pos(page, 5)).toHaveAttribute("aria-label", /\(libero\)/);
    await expect(page.getByText(`In campo al posto di ${playerLabel(centrale)}`)).toBeVisible();

    // Fatto uscire a mano non rientra da solo; si rimette con la scorciatoia.
    await page.getByRole("button", { name: `Esce · rientra ${playerLabel(centrale)}` }).click();
    await expect(pos(page, 5)).toHaveAttribute("aria-label", `P5: ${playerLabel(centrale)}`);
    await expect(page.getByText(`Uscito a mano: non rientra da solo per ${playerLabel(centrale)}`)).toBeVisible();
    await expect(feedTop(page)).toContainText(`Libero esce · rientra ${playerLabel(centrale)}`);
    await page.getByRole("button", { name: `Entra per ${playerLabel(centrale)} (centrale)` }).click();
    await expect(pos(page, 5)).toHaveAttribute("aria-label", /\(libero\)/);
    await expect(feedTop(page)).toContainText(`Libero entra per ${playerLabel(centrale)}`);

    // L'altro libero prende il suo posto senza consumare cambi.
    const other = present.map((x) => player(x.playerId)).find((p) => p.role === "L" && p.id !== lineup.liberoId);
    if (other) {
      await page.getByRole("button", { name: `Cambia con ${playerLabel(other)}` }).click();
      await expect(pos(page, 5)).toHaveAttribute("aria-label", `P5: ${playerLabel(other)} (libero)`);
      await expect(page.getByRole("button", { name: /^Cambio 1\/6/ })).toBeVisible();
      await expect(feedTop(page)).toContainText(`Cambio libero · entra ${playerLabel(other)}`);
    }
    await page.getByRole("button", { name: "Ruota" }).click();
    await expect(page.locator("[aria-label*='(libero)']")).toHaveCount(0);
    await expect(page.getByText(/^In campo al posto di/)).toHaveCount(0);
  });

  await test.step("timeout e correzione del punteggio", async () => {
    const timeout = page.getByRole("group", { name: `Timeout di ${TEAM_NAME}` });
    const addTimeout = page.getByRole("button", { name: `Aggiungi un timeout a ${TEAM_NAME}` });
    for (let i = 0; i < 3; i++) await addTimeout.click();
    await expect(timeout).toContainText("3/2");
    await expect(timeout).toHaveClass(/text-red/);
    // −1 toglie l'ultimo timeout (resta nel registro come annullato).
    await page.getByRole("button", { name: `Togli un timeout a ${TEAM_NAME}` }).click();
    await expect(timeout).toContainText("2/2");

    await page.getByRole("button", { name: "Correggi" }).click();
    await page.getByRole("button", { name: `Aggiungi un punto a ${opponent}` }).click();
    await page.getByRole("button", { name: `Aggiungi un punto a ${opponent}` }).click();
    await page.getByRole("button", { name: `Togli un punto a ${opponent}` }).click();
    expect(await score(page)).toMatchObject({ us: 1, them: 1 });
    await expect(feedTop(page)).toContainText(`Correzione punteggio: −1 ${opponent}`);
    await page.getByRole("button", { name: "Fatto" }).click();
  });

  await test.step("scambio di posto a set in corso, poi Annulla", async () => {
    const before = [await pos(page, 2).getAttribute("aria-label"), await pos(page, 3).getAttribute("aria-label")];
    const who = (label: string | null) => label?.replace(/^P\d: /, "").replace(/,.*$/, "") ?? "";
    await page.getByRole("button", { name: "⇄ Scambia" }).click();
    await pos(page, 2).click();
    await pos(page, 3).click();
    await expect(pos(page, 2)).toHaveAttribute("aria-label", new RegExp(`^P2: ${esc(who(before[1]))}`));
    await expect(pos(page, 3)).toHaveAttribute("aria-label", new RegExp(`^P3: ${esc(who(before[0]))}`));
    await expect(feedTop(page)).toContainText("Scambio di posto");
    await expect(page.getByRole("button", { name: /^Cambio 1\/6/ })).toBeVisible();
    await page.getByRole("button", { name: "↶ Annulla" }).click();
    await expect(pos(page, 2)).toHaveAttribute("aria-label", before[0] ?? "");
  });

  await test.step("semplice: azione senza punto ed errore avversario col tipo, poi Annulla", async () => {
    const start = await score(page);
    // Chi è in P4 adesso (dopo i cambi).
    const p4 = (await pos(page, 4).getAttribute("aria-label"))?.replace(/^P4: /, "").replace(/[,(].*$/, "").trim();
    const attacker = roster.find((p) => playerLabel(p) === p4) as P;
    expect(attacker, `giocatore in P4: ${p4}`).toBeTruthy();
    await page.getByRole("group", { name: "Azioni senza punto" }).getByRole("button", { name: "Attacco giocato" }).click();
    await page.getByRole("button", { name: numbered(attacker) }).click();
    await expect(feedTop(page)).toContainText(`Attacco in campo · ${playerLabel(attacker)}`);
    expect(await score(page)).toEqual(start);

    await page.getByRole("button", { name: new RegExp(`\\+1\\s*${TEAM_NAME}`, "i") }).click();
    await page.getByRole("button", { name: "Errore avversario" }).click();
    await page.getByRole("button", { name: "Battuta sbagliata" }).click();
    await expect(feedTop(page)).toContainText(`Errore ${opponent} · battuta sbagliata`);
    expect(await score(page)).toMatchObject({ us: start.us + 1 });

    // Annulla: tipo dell'errore, punto, azione senza punto.
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "↶ Annulla" }).click();
    expect(await score(page)).toEqual(start);
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
    // Annullati: il punto loro, il timeout tolto con −1, lo scambio di posto, l'attacco giocato e l'errore avversario.
    expect(events.filter((e) => e.deleted).map((e) => e.kind).sort()).toEqual(["action", "action", "action", "swap", "timeout"]);
  });

  await test.step("Storico: correzione con ricalcolo, modifica che romperebbe il set rifiutata", async () => {
    await page.goto(`/admin/storico?partita=${matchId}`);
    await expect(page.getByRole("link", { name: new RegExp(esc(opponent), "i") })).toHaveAttribute("aria-current", "page");
    // Il punto d'attacco del set 1 passa a un altro giocatore: punteggio e parziali non cambiano.
    const other = player(slots[1]);
    await page.getByRole("button", { name: /Attacco · Punto/ }).click();
    await page.getByLabel("Giocatore").selectOption(String(other.id));
    await page.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp(`Attacco · Punto.*${esc(playerLabel(other))}`) })).toBeVisible();
    const kill = await db.select().from(s.events).where(and(eq(s.events.matchId, matchId), eq(s.events.skill, "attack"), eq(s.events.outcome, "kill")));
    expect(kill.map((e) => e.playerId)).toEqual([other.id]);

    // Un errore avversario diventato punto loro lascerebbe il set 1 a 24–2: rifiutato, nulla cambia.
    await page.getByRole("button", { name: /Errore avversario/ }).first().click();
    await page.getByLabel("Fondamentale").selectOption("opp_point");
    await page.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(page.getByText(/il set 1 finirebbe 24–2/)).toBeVisible();
    const sets = await db.select().from(s.matchSets).where(eq(s.matchSets.matchId, matchId));
    expect(sets.sort((a, b) => a.n - b.n).map((x) => `${x.us}-${x.them}`)).toEqual(["25-1", "25-0", "25-0"]);
  });

  await test.step("riepilogo pubblico della partita", async () => {
    await page.goto(`/partite/${matchId}`);
    await expect(page.getByText("Vinta", { exact: true })).toBeVisible();
    await expect(page.getByText("MVP della partita")).toBeVisible();
    await expect(page.getByText(fullName(player(slots[3])), { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Come abbiamo fatto punto" })).toBeVisible();
    await expect(page.getByText("25–1")).toBeVisible();
  });

  await test.step("statistiche pubbliche: la partita c'è e si può scegliere da sola", async () => {
    await page.goto("/statistiche");
    const filter = page.getByLabel("Partite");
    const value = await filter.locator("option", { hasText: opponent }).getAttribute("value");
    expect(value).toBe(String(matchId));
    await filter.selectOption(String(matchId));
    await expect(page.getByText("1 vinte · 0 perse")).toBeVisible();
    // Chi ha fatto il punto d'attacco del set 1 (poi spostato nello Storico) è in tabella.
    await expect(page.getByRole("rowheader", { name: new RegExp(esc(shortName(player(slots[1])))) })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "scroll orizzontale nelle statistiche").toBeLessThanOrEqual(0);
  });

  await test.step("pagine pubbliche e controlli finali", async () => {
    await page.goto("/calendario");
    await expect(page.getByText(opponentFull).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "scroll orizzontale nel calendario").toBeLessThanOrEqual(0);
    expect(errors, "errori JavaScript nella pagina").toEqual([]);
  });
});
