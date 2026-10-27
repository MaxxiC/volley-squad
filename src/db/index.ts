import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL mancante: copialo in .env.local (vedi .env.example)");
}

export const db = drizzle(neon(process.env.DATABASE_URL), { schema, casing: "snake_case" });

export type Db = typeof db;
