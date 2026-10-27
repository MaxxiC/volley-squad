import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Protegge tutta l'area staff: senza sessione → /admin/login.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*"],
};
