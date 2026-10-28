// Prima dell'E2E: copia del DB (in memoria e su file), utente temporaneo e partita temporanea.
// La funzione restituita gira alla fine anche se il test fallisce: ripristina e verifica che il DB
// sia identico alla copia, altrimenti fa fallire il comando e lascia il file per `npm run test:restore`.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { FullConfig } from "@playwright/test";
import { and, asc, eq, ne } from "drizzle-orm";
import { TEAM_NAME } from "@/lib/club";
import { EMPTY_SLOTS, fillInOrder } from "@/lib/lineup";
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
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3001";
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
    const { db, runBatch, schema } = await openDb();
    const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.isCurrent, true) });
    const opponent = await db.query.teams.findFirst({ where: and(eq(schema.teams.isUs, false), ne(schema.teams.name, "")) });
    if (!season || !opponent) throw new Error("Nel DB mancano la stagione corrente o un avversario");
    const startsAt = new Date(Date.now() + 24 * 3600_000);
    startsAt.setUTCHours(20, 0, 0, 0);
    const [match] = await db
      .insert(schema.matches)
      .values({ seasonId: season.id, phase: "ritorno", round: 99, home: true, opponentId: opponent.id, venue: "Test E2E", startsAt })
      .returning({ id: schema.matches.id });

    // Partite già "in corso" (presenti tutti, formazione automatica, battiamo noi) per offline e invio.
    const roster = await db.query.players.findMany({ where: eq(schema.players.active, true), orderBy: [asc(schema.players.number)] });
    const { slots, libero } = fillInOrder(EMPTY_SLOTS, null, roster);
    if (slots.some((x) => x === null)) throw new Error("Rosa insufficiente per la formazione di test");
    const [p1, p2, p3, p4, p5, p6] = slots as number[];
    const liveMatch = async (round: number) => {
      const [m] = await db
        .insert(schema.matches)
        .values({ seasonId: season.id, phase: "ritorno", round, home: true, opponentId: opponent.id, venue: "Test E2E", startsAt, status: "live" })
        .returning({ id: schema.matches.id });
      await runBatch([
        db.insert(schema.matchPlayers).values(roster.map((p) => ({ matchId: m.id, playerId: p.id, role: p.role }))),
        db.insert(schema.lineups).values({ matchId: m.id, setN: 1, p1, p2, p3, p4, p5, p6, liberoId: libero, serveFirst: "us" }),
      ]);
      return m.id;
    };

    process.env.E2E_PASSWORD = password;
    process.env.E2E_MATCH_ID = String(match.id);
    process.env.E2E_OFFLINE_MATCH_ID = String(await liveMatch(98));
    process.env.E2E_SYNC_MATCH_ID = String(await liveMatch(97));
    process.env.E2E_OPPONENT = opponent.name;
  } catch (err) {
    await teardown();
    throw err;
  }
  return teardown;
}
