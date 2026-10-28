// Copia e ripristino del DB reale per i test E2E.
// Prima del test si fotografano le tabelle (anche su file, per recuperare se il test si interrompe);
// dopo si riporta ogni tabella identica alla foto toccando solo le righe diverse, in una transazione,
// e si verifica rileggendo tutto. Gli utenti non vanno sul file (hash delle password): l'utente di
// test si elimina per email.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { and, eq, getTableColumns, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgTable } from "drizzle-orm/pg-core";

export const E2E_EMAIL = "e2e-temp@cusbros.local";
export const SNAPSHOT_DIR = path.join(process.cwd(), "tests", ".snapshots");

type Row = Record<string, unknown>;
type Spec = { name: string; table: PgTable; key: string[] };
export type Snapshot = { takenAt: string; tables: Record<string, Row[]>; users: { id: number; email: string }[] };

/** Il modulo del DB legge DATABASE_URL all'import: prima si carica .env. */
export async function openDb() {
  loadEnvConfig(process.cwd());
  const [{ db, runBatch }, schema] = await Promise.all([import("@/db"), import("@/db/schema")]);
  return { db, runBatch, schema };
}

/** Tabelle salvate, dalle "padre" alle "figlie" (inserimenti in quest'ordine, cancellazioni al contrario). */
async function specs(): Promise<Spec[]> {
  const s = (await openDb()).schema;
  return [
    { name: "seasons", table: s.seasons, key: ["id"] },
    { name: "teams", table: s.teams, key: ["id"] },
    { name: "players", table: s.players, key: ["id"] },
    { name: "matches", table: s.matches, key: ["id"] },
    { name: "match_sets", table: s.matchSets, key: ["id"] },
    { name: "standings", table: s.standings, key: ["id"] },
    { name: "match_players", table: s.matchPlayers, key: ["matchId", "playerId"] },
    { name: "lineups", table: s.lineups, key: ["id"] },
    { name: "events", table: s.events, key: ["id"] },
    // I login sbagliati dei test lasciano tentativi falliti: il ripristino li toglie.
    { name: "login_attempts", table: s.loginAttempts, key: ["id"] },
  ];
}

const keyOf = (spec: Spec, row: Row) => spec.key.map((k) => String(row[k])).join(":");
/** Forma confrontabile di una riga (le date diventano ISO, come sul file). */
const canon = (row: Row) => JSON.stringify(row);

/** Dal file le date tornano stringhe: si riconvertono per le colonne timestamp. */
function revive(spec: Spec, row: Row): Row {
  const columns = getTableColumns(spec.table);
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, columns[k]?.dataType === "date" && typeof v === "string" ? new Date(v) : v]),
  );
}

function whereKey(spec: Spec, row: Row): SQL {
  const columns = getTableColumns(spec.table);
  const parts = spec.key.map((k) => eq(columns[k], row[k]));
  return parts.length === 1 ? parts[0] : (and(...parts) as SQL);
}

export async function takeSnapshot(): Promise<Snapshot> {
  const { db, schema } = await openDb();
  const tables: Record<string, Row[]> = {};
  for (const spec of await specs()) tables[spec.name] = await db.select().from(spec.table);
  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  return { takenAt: new Date().toISOString(), tables, users };
}

export function saveSnapshot(snap: Snapshot) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const file = path.join(SNAPSHOT_DIR, `db-${snap.takenAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(snap, null, 1));
  return file;
}

/** File di copia rimasti da un test interrotto (dal più recente). */
export function pendingSnapshots() {
  if (!existsSync(SNAPSHOT_DIR)) return [];
  return readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.startsWith("db-") && f.endsWith(".json"))
    .sort()
    .reverse()
    .map((f) => path.join(SNAPSHOT_DIR, f));
}

export function loadSnapshot(file: string): Snapshot {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function removeSnapshot(file: string) {
  rmSync(file, { force: true });
}

type Plan = { spec: Spec; insert: Row[]; update: Row[]; remove: Row[] }[];

/** Righe da cancellare, inserire o riscrivere per tornare alla copia. */
async function plan(snap: Snapshot): Promise<Plan> {
  const { db } = await openDb();
  const result: Plan = [];
  for (const spec of await specs()) {
    const saved = new Map((snap.tables[spec.name] ?? []).map((r) => [keyOf(spec, r), revive(spec, r)]));
    const now = new Map((await db.select().from(spec.table)).map((r: Row) => [keyOf(spec, r), r]));
    const insert: Row[] = [];
    const update: Row[] = [];
    const remove: Row[] = [];
    for (const [k, row] of saved) {
      const current = now.get(k);
      if (!current) insert.push(row);
      else if (canon(current) !== canon(row)) update.push(row);
    }
    for (const [k, row] of now) if (!saved.has(k)) remove.push(row);
    result.push({ spec, insert, update, remove });
  }
  return result;
}

/** Differenze tra DB e copia, leggibili ("matches: 1 da eliminare"). Vuoto = identico. */
export async function differences(snap: Snapshot): Promise<string[]> {
  const out: string[] = [];
  for (const { spec, insert, update, remove } of await plan(snap)) {
    const parts = [
      remove.length && `${remove.length} in più`,
      insert.length && `${insert.length} mancanti`,
      update.length && `${update.length} modificate`,
    ].filter(Boolean);
    if (parts.length) out.push(`${spec.name}: ${parts.join(", ")}`);
  }
  return out;
}

/** Riporta il DB identico alla copia (una sola transazione) ed elimina l'utente di test. */
export async function restoreSnapshot(snap: Snapshot) {
  const { db, runBatch, schema } = await openDb();
  const steps = await plan(snap);
  const queries: BatchItem<"pg">[] = [];
  for (const { spec, remove } of [...steps].reverse()) {
    for (const row of remove) queries.push(db.delete(spec.table).where(whereKey(spec, row)));
  }
  for (const { spec, insert } of steps) if (insert.length) queries.push(db.insert(spec.table).values(insert));
  for (const { spec, update } of steps) {
    for (const row of update) {
      const fields = Object.fromEntries(Object.entries(row).filter(([k]) => !spec.key.includes(k)));
      queries.push(db.update(spec.table).set(fields).where(whereKey(spec, row)));
    }
  }
  queries.push(db.delete(schema.users).where(eq(schema.users.email, E2E_EMAIL)));
  await runBatch(queries);
}

/** L'utente di test è ancora nel DB? */
export async function e2eUserLeft() {
  const { db, schema } = await openDb();
  return Boolean(await db.query.users.findFirst({ where: eq(schema.users.email, E2E_EMAIL), columns: { id: true } }));
}

/** Utenti diversi da quelli della copia (subito dopo il ripristino deve essere vuoto). */
export async function userDifferences(snap: Snapshot): Promise<string[]> {
  const { db, schema } = await openDb();
  const now = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  const saved = new Set(snap.users.map((u) => `${u.id}:${u.email}`));
  const current = new Set(now.map((u) => `${u.id}:${u.email}`));
  return [
    ...now.filter((u) => !saved.has(`${u.id}:${u.email}`)).map((u) => `utente in più: ${u.email}`),
    ...snap.users.filter((u) => !current.has(`${u.id}:${u.email}`)).map((u) => `utente mancante: ${u.email}`),
  ];
}
