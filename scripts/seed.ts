// npm run db:seed — carica i dati di esempio su un database vuoto.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import("../src/db");
  const { seed } = await import("../src/db/seed");
  const done = await seed(db);
  console.log(done ? "Seed completato." : "Il database contiene già una stagione: seed saltato.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
