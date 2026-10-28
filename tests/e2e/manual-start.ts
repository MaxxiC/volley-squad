// npm run test:manual → prepara una prova a mano sul DB reale (es. dal telefono):
// copia del DB su file (come gli E2E) e una partita "Prova telefono" da giocare con il proprio utente.
// A prova finita: npm run test:restore (mostra le differenze) e npm run test:restore -- --apply.
// Durante la prova usare solo quella partita: il ripristino riporta TUTTE le tabelle a com'erano.
import { and, eq, ne } from "drizzle-orm";
import { openDb, pendingSnapshots, saveSnapshot, takeSnapshot } from "./db-snapshot";

async function main() {
  const left = pendingSnapshots();
  if (left.length) {
    console.error(`C'è già una copia in sospeso (${left[0]}): chiudi prima la prova precedente con "npm run test:restore"`);
    process.exit(1);
  }
  const file = saveSnapshot(await takeSnapshot());

  const { db, schema } = await openDb();
  const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.isCurrent, true) });
  const opponent = await db.query.teams.findFirst({ where: and(eq(schema.teams.isUs, false), ne(schema.teams.name, "")) });
  if (!season || !opponent) throw new Error("Nel DB mancano la stagione corrente o un avversario");
  // Tra mezz'ora: così Prepara Live la propone per prima.
  const startsAt = new Date(Date.now() + 30 * 60_000);
  const [match] = await db
    .insert(schema.matches)
    .values({ seasonId: season.id, phase: "ritorno", round: 99, home: true, opponentId: opponent.id, venue: "Prova telefono (da eliminare)", startsAt })
    .returning({ id: schema.matches.id });

  console.log(`Copia del DB: ${file}`);
  console.log(`Partita di prova creata (id ${match.id}, contro ${opponent.name}): Admin → Live → /admin/live?partita=${match.id}`);
  console.log('A prova finita: "npm run test:restore" e poi "npm run test:restore -- --apply".');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
