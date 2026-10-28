import { neon } from "@neondatabase/serverless";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL mancante: copialo in .env.local (vedi .env.example)");
}

export const db = drizzle(neon(process.env.DATABASE_URL), { schema, casing: "snake_case" });

export type Db = typeof db;

/** Esegue più query in un'unica transazione (il driver HTTP di Neon non ha transazioni interattive). */
export async function runBatch(queries: BatchItem<"pg">[]) {
  const [first, ...rest] = queries;
  if (first) await db.batch([first, ...rest]);
}
