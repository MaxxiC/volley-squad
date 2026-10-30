// Amichevoli: si creano da Admin Partite senza giornata né numero gara, nel Calendario hanno la
// scritta e il filtro Campionato / Amichevoli. Squadra e partita create qui spariscono col ripristino
// del DB (global-setup), e la partita si elimina comunque alla fine.
import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { openDb } from "./db-snapshot";
import { login } from "./helpers";

test("amichevole: creazione, calendario con filtro, eliminazione", async ({ page }) => {
  const opponent = `E2E Amici ${randomBytes(3).toString("hex")}`;
  const { db, schema: s } = await openDb();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("nuova partita amichevole da Admin Partite", async () => {
    await login(page, "/admin/partite");
    await page.getByRole("button", { name: "+ Nuova partita" }).click();
    await page.getByRole("group", { name: "Tipo" }).getByRole("button", { name: "Amichevole" }).click();
    // Niente fase, giornata né numero gara.
    await expect(page.getByLabel("Giornata")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Fase" })).toHaveCount(0);
    await page.getByLabel("Data", { exact: true }).fill("2027-05-20");
    await page.getByLabel("Ora", { exact: true }).fill("20:00");
    await page.getByLabel("Avversario", { exact: true }).fill(opponent);
    await page.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(page.getByText(opponent).first()).toBeVisible();

    const team = await db.query.teams.findFirst({ where: eq(s.teams.name, opponent) });
    const m = team && (await db.query.matches.findFirst({ where: eq(s.matches.opponentId, team.id) }));
    expect(m).toMatchObject({ friendly: true, round: 0, number: null, status: "scheduled" });
  });

  await test.step("calendario: scritta e filtro Campionato / Amichevoli", async () => {
    await page.goto("/calendario");
    const card = page.locator("article", { hasText: opponent });
    await expect(card).toContainText("Amichevole");
    const kinds = page.getByRole("group", { name: "Campionato o amichevoli" });
    await kinds.getByRole("button", { name: "Campionato" }).click();
    await expect(card).toHaveCount(0);
    await kinds.getByRole("button", { name: "Amichevoli" }).click();
    await expect(card).toBeVisible();
    await expect(page.locator("article")).toHaveCount(await page.locator("article", { hasText: "Amichevole" }).count());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "scroll orizzontale nel calendario").toBeLessThanOrEqual(0);
  });

  await test.step("eliminazione", async () => {
    await page.goto("/admin/partite");
    const row = page.locator("article", { hasText: opponent });
    await expect(row).toContainText("Amichevole");
    await row.getByRole("button", { name: "Modifica" }).click();
    // Un'amichevole non ha "Duplica come ritorno".
    await expect(row.getByRole("button", { name: "Duplica come ritorno" })).toHaveCount(0);
    await page.getByRole("button", { name: "Elimina", exact: true }).click();
    await page.getByRole("button", { name: "Elimina definitivamente" }).click();
    await expect(page.getByText(opponent)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
