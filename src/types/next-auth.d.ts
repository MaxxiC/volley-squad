import type { DefaultSession } from "next-auth";

type UserRole = "admin" | "coach";

declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt riesporta questo modulo: l'estensione va fatta qui.
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
  }
}
