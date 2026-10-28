// Pezzi comuni degli E2E del Live.
import { expect, type Page } from "@playwright/test";
import { E2E_EMAIL } from "./db-snapshot";

export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Login con l'utente temporaneo creato da global-setup, poi `path`. */
export async function login(page: Page, path: string) {
  await page.goto(`/admin/login?callbackUrl=${encodeURIComponent(path)}`);
  await page.fill("input[name=email]", E2E_EMAIL);
  await page.fill("input[name=password]", process.env.E2E_PASSWORD ?? "");
  await page.click("button[type=submit]");
}

/** Punteggio e set dal tabellone. */
export async function score(page: Page) {
  const board = page.getByRole("region", { name: "Punteggio" });
  const cols = board.locator(":scope > div");
  const num = async (i: number) => Number(await cols.nth(i).locator(":scope > span").last().innerText());
  return { us: await num(0), them: await num(2), sets: (await cols.nth(1).locator(":scope > span").last().innerText()).trim() };
}

/** Indicatore accanto ad Annulla/Ripeti. */
export const syncStatus = (page: Page) => page.getByRole("status").filter({ hasText: /Sincronizzato|Offline|Salvataggio|Non salvato|Sessione scaduta|Lettura dal telefono/ });

export const saved = (page: Page) => expect(syncStatus(page)).toHaveText(/Sincronizzato/, { timeout: 30_000 });
