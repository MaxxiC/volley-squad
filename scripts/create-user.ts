// npm run user:create -- <email> "<nome>" <admin|coach>
// Chiede la password (non viene mostrata). Se l'email esiste già aggiorna nome, ruolo e password.
import { loadEnvConfig } from "@next/env";
import { createInterface } from "node:readline";
import { z } from "zod";

loadEnvConfig(process.cwd());

const Input = z.object({
  email: z.email("Email non valida").transform((s) => s.toLowerCase()),
  name: z.string().trim().min(1, "Nome obbligatorio"),
  role: z.enum(["admin", "coach"], "Ruolo: admin oppure coach"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

/** Legge la password senza mostrarla a schermo. */
function askPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const muted = rl as unknown as { _writeToOutput: (s: string) => void };
    process.stdout.write(prompt);
    muted._writeToOutput = () => {};
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const [email, name, role] = process.argv.slice(2);
  const password = process.env.NEW_USER_PASSWORD ?? (await askPassword("Password: "));
  const parsed = Input.safeParse({ email, name, role, password });
  if (!parsed.success) {
    console.error(parsed.error.issues.map((i) => `- ${i.message}`).join("\n"));
    console.error('\nUso: npm run user:create -- <email> "<nome>" <admin|coach>');
    process.exit(1);
  }

  const { hash } = await import("bcryptjs");
  const { db } = await import("../src/db");
  const { users } = await import("../src/db/schema");

  const data = parsed.data;
  const passwordHash = await hash(data.password, 12);
  await db
    .insert(users)
    .values({ email: data.email, name: data.name, role: data.role, passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { name: data.name, role: data.role, passwordHash } });

  console.log(`Utente ${data.email} (${data.role}) salvato.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
