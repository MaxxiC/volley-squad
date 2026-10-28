// E2E sul DB reale (npm run test:e2e): serve il dev server già avviato (npm run dev).
// Copia e ripristino del DB in tests/e2e/global-setup.ts. Un solo worker: i test condividono il DB.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // Il dev server compila le pagine alla prima visita: tempi larghi.
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    ...devices["Pixel 7"],
    // Stessa larghezza del telefono di riferimento del design.
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
