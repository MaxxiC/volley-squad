// npm run test:restore            → mostra cosa cambierebbe ripristinando la copia lasciata da un E2E interrotto
// npm run test:restore -- --apply → ripristina, verifica ed elimina il file
// Attenzione: la copia riporta le tabelle a com'erano prima del test, quindi annulla anche le modifiche
// fatte dopo. Gli utenti non si toccano, a parte l'eliminazione dell'utente di test.
import { E2E_EMAIL, differences, e2eUserLeft, loadSnapshot, pendingSnapshots, removeSnapshot, restoreSnapshot } from "./db-snapshot";

async function check(file: string) {
  const snap = loadSnapshot(file);
  const diff = await differences(snap);
  if (await e2eUserLeft()) diff.push(`utente di test ${E2E_EMAIL} ancora presente`);
  return { snap, diff };
}

async function main() {
  const [file, ...older] = pendingSnapshots();
  if (!file) {
    console.log("Nessuna copia in sospeso: il DB non ha bisogno di ripristino.");
    return;
  }
  if (older.length) console.log(`Ci sono altre ${older.length} copie più vecchie in tests/.snapshots: si usa la più recente.`);
  const { snap, diff } = await check(file);
  console.log(`Copia del ${new Date(snap.takenAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} (${file})`);
  if (!diff.length) {
    console.log("Il DB è già identico alla copia: file eliminato.");
    removeSnapshot(file);
    return;
  }
  console.log(`Differenze:\n- ${diff.join("\n- ")}`);
  if (!process.argv.includes("--apply")) {
    console.log("\nNiente è stato modificato. Per ripristinare: npm run test:restore -- --apply");
    return;
  }
  await restoreSnapshot(snap);
  const after = (await check(file)).diff;
  if (after.length) {
    console.error(`Ripristino NON identico:\n- ${after.join("\n- ")}`);
    process.exit(1);
  }
  removeSnapshot(file);
  console.log("DB ripristinato e verificato identico alla copia.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
