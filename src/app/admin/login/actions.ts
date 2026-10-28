"use server";

import { AuthError } from "next-auth";
import { TooManyAttempts, signIn } from "@/auth";
import { TOO_MANY_ATTEMPTS } from "@/lib/login-limit";
import { safeRedirect } from "./safe-redirect";

/** `email` torna al form: React svuota i campi dopo l'invio, così non va riscritta. */
export type LoginState = { error?: string; email?: string };

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
      const tooMany = err instanceof TooManyAttempts || (err.type === "CredentialsSignin" && "code" in err && err.code === "troppi_tentativi");
      return {
        email,
        error: tooMany ? TOO_MANY_ATTEMPTS : err.type === "CredentialsSignin" ? "Email o password non corretti." : "Accesso non riuscito, riprova.",
      };
    }
    // Il redirect dopo il login è un'eccezione di Next: va rilanciata.
    throw err;
  }
}
