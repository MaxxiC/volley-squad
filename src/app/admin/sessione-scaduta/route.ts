// Uscita per chi ha ancora un token firmato ma non è più tra gli utenti (es. eliminato): il
// middleware lo lascerebbe passare e il login lo rimanderebbe dentro. Qui la sessione si cancella
// e si torna al login. Chi è ancora un utente valido viene solo rimandato all'area staff, così un
// link a questa pagina non può far uscire nessuno.
import { NextResponse } from "next/server";
import { signOut } from "@/auth";
import { ADMIN_HOME, LOGIN_PATH } from "@/auth.config";
import { currentStaff } from "@/lib/auth-guard";

export async function GET(request: Request) {
  if (await currentStaff()) return NextResponse.redirect(new URL(ADMIN_HOME, request.url));
  return signOut({ redirectTo: LOGIN_PATH });
}
