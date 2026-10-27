// Configurazione Auth.js senza dipendenze Node (DB, bcrypt): la usa anche il middleware.
import type { NextAuthConfig } from "next-auth";

export const LOGIN_PATH = "/admin/login";
export const ADMIN_HOME = "/admin/partite";

export const authConfig = {
  pages: { signIn: LOGIN_PATH },
  // Sessione lunga: in palestra non si deve perdere il login.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = Boolean(auth?.user);
      if (nextUrl.pathname === LOGIN_PATH) {
        return loggedIn ? Response.redirect(new URL(ADMIN_HOME, nextUrl)) : true;
      }
      // false → redirect a LOGIN_PATH con callbackUrl
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
