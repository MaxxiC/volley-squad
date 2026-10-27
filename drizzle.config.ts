import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Carica .env.local come fa Next.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
