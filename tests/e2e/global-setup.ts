// Prima dell'E2E: copia del DB (in memoria e su file), utente temporaneo e partita temporanea.
// La funzione restituita gira alla fine anche se il test fallisce: ripristina e verifica che il DB
// sia identico alla copia, altrimenti fa fallire il comando e lascia il file per `npm run test:restore`.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { FullConfig } from "@playwright/test";
import { and, eq, ne } from "drizzle-orm";
import { TEAM_NAME } from "@/lib/club";
import {
  E2E_EMAIL,
  differences,
  openDb,
  pendingSnapshots,
  removeSnapshot,
  restoreSnapshot,
  saveSnapshot,
  takeSnapshot,
  userDifferences,
} from "./db-snapshot";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const left = pendingSnapshots();
  if (left.length) {
    throw new Error(`C'è una copia del DB di un test interrotto (${left[0]}): controlla con "npm run test:restore" prima di rilanciare`);
  }
  // Senza server (o con un'altra app sulla stessa porta) non si tocca il DB.
  const login = await fetch(`${baseURL}/admin/login`)
    .then((r) => r.text())
    .catch(() => {
      throw new Error(`Server non raggiungibile su ${baseURL}: avvia prima "npm run dev"`);
    });
  if (!login.includes(TEAM_NAME)) {
    throw new Error(`Su ${baseURL} non risponde ${TEAM_NAME}: avvia "npm run dev" o indica la porta con E2E_BASE_URL`);
  }

  const snap = await takeSnapshot();
  const file = saveSnapshot(snap);

  const teardown = async () => {
    await restoreSnapshot(snap);
    const diff = [...(await differences(snap)), ...(await userDifferences(snap))];
    if (diff.length) {
      throw new Error(`Ripristino del DB NON identico (copia in ${file}):\n${diff.join("\n")}`);
    }
    removeSnapshot(file);
    console.log("DB ripristinato e verificato identico alla copia.");
  };

  try {
    const password = randomBytes(18).toString("base64url");
    execSync(`npm run user:create -- ${E2E_EMAIL} "Test E2E" coach`, {
      env: { ...process.env, NEW_USER_PASSWORD: password },
      stdio: "ignore",
    });

    // Partita temporanea domani alle 21 contro una squadra già presente: le partite vere non si toccano.
    const { db, schema } = await openDb();
    const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.isCurrent, true) });
    const opponent = await db.query.teams.findFirst({ where: and(eq(schema.teams.isUs, false), ne(schema.teams.name, "")) });
    if (!season || !opponent) throw new Error("Nel DB mancano la stagione corrente o un avversario");
    const startsAt = new Date(Date.now() + 24 * 3600_000);
    startsAt.setUTCHours(20, 0, 0, 0);
    const [match] = await db
      .insert(schema.matches)
      .values({ seasonId: season.id, phase: "ritorno", round: 99, home: true, opponentId: opponent.id, venue: "Test E2E", startsAt })
      .returning({ id: schema.matches.id });

    process.env.E2E_PASSWORD = password;
    process.env.E2E_MATCH_ID = String(match.id);
    process.env.E2E_OPPONENT = opponent.name;
  } catch (err) {
    await teardown();
    throw err;
  }
  return teardown;
}
