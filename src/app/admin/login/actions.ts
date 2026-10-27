"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { ADMIN_HOME, LOGIN_PATH } from "@/auth.config";

/** `email` torna al form: React svuota i campi dopo l'invio, così non va riscritta. */
export type LoginState = { error?: string; email?: string };

/** Accetta solo percorsi interni all'area staff (niente redirect verso altri siti). */
function safeRedirect(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw) return ADMIN_HOME;
  const { pathname, search } = new URL(raw, "http://localhost");
  return pathname.startsWith("/admin/") && pathname !== LOGIN_PATH ? pathname + search : ADMIN_HOME;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        email,
        error: err.type === "CredentialsSignin" ? "Email o password non corretti." : "Accesso non riuscito, riprova.",
      };
    }
    // Il redirect dopo il login è un'eccezione di Next: va rilanciata.
    throw err;
  }
}
