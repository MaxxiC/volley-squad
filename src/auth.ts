import { compare } from "bcryptjs";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db";
import { loginAttempts, users } from "@/db/schema";
import { LOGIN_WINDOW_MS, clientIp, loginBlocked } from "@/lib/login-limit";
import { authConfig } from "./auth.config";

const LoginInput = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(1),
});

// Confronto fittizio quando l'email non esiste: stessi tempi di risposta, non si scopre chi è registrato.
const DUMMY_HASH = "$2b$12$TMBbqkOw.TdoqWQgWDf8s.wInjJhgrQdNTw9Xl5RrbEcqGVJcep/K";

/** Troppi errori recenti: il login mostra un messaggio apposito (vedi admin/login/actions.ts). */
export class TooManyAttempts extends CredentialsSignin {
  code = "troppi_tentativi";
}

/** Errori recenti per email+connessione, connessione ed email (una sola lettura). */
async function recentFailures(email: string, ip: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [row] = await db
    .select({
      emailIp: sql<number>`count(*) filter (where ${loginAttempts.email} = ${email} and ${loginAttempts.ip} = ${ip})`.mapWith(Number),
      ip: sql<number>`count(*) filter (where ${loginAttempts.ip} = ${ip})`.mapWith(Number),
      email: sql<number>`count(*) filter (where ${loginAttempts.email} = ${email})`.mapWith(Number),
    })
    .from(loginAttempts)
    .where(and(gt(loginAttempts.createdAt, since), or(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip))));
  return row ?? { emailIp: 0, ip: 0, email: 0 };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // Il limite sta qui e non nel form: l'endpoint di Auth.js si può chiamare anche direttamente.
      async authorize(raw, request) {
        const parsed = LoginInput.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = clientIp(request.headers);

        if (loginBlocked(await recentFailures(email, ip))) throw new TooManyAttempts();

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        const ok = await compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) {
          await db.insert(loginAttempts).values({ email, ip });
          // Pulizia: i tentativi di oltre un giorno non servono più.
          await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 3600_000)));
          return null;
        }
        await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
        return { id: String(user.id), email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
