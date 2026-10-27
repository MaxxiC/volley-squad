import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authConfig } from "./auth.config";

const LoginInput = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(1),
});

// Confronto fittizio quando l'email non esiste: stessi tempi di risposta, non si scopre chi è registrato.
const DUMMY_HASH = "$2b$12$TMBbqkOw.TdoqWQgWDf8s.wInjJhgrQdNTw9Xl5RrbEcqGVJcep/K";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = LoginInput.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
        const ok = await compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) return null;

        return { id: String(user.id), email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
