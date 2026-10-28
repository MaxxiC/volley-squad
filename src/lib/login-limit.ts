// Limite ai tentativi di accesso. Tre soglie nella stessa finestra di 15 minuti:
// - stessa email dalla stessa connessione: 5 errori (il caso normale di chi prova password);
// - stessa connessione, qualsiasi email: 20 (chi prova tante email);
// - stessa email da qualsiasi connessione: 50 (attacco da tanti indirizzi). Più largo apposta:
//   chi conosce un'email non deve poter bloccare il suo proprietario con pochi tentativi.

export const LOGIN_WINDOW_MS = 15 * 60_000;

export const LOGIN_LIMITS = { emailIp: 5, ip: 20, email: 50 } as const;

/** Errori recenti (nella finestra) contati per email+connessione, per connessione e per email. */
export type LoginFailures = Record<keyof typeof LOGIN_LIMITS, number>;

/** true = troppi errori: l'accesso si rifiuta senza nemmeno controllare la password. */
export function loginBlocked(failures: LoginFailures) {
  return (Object.keys(LOGIN_LIMITS) as (keyof typeof LOGIN_LIMITS)[]).some((k) => failures[k] >= LOGIN_LIMITS[k]);
}

/** Connessione del richiedente: su Vercel il primo indirizzo di x-forwarded-for. */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "sconosciuto";
}

export const TOO_MANY_ATTEMPTS = "Troppi tentativi sbagliati: riprova tra qualche minuto (al massimo 15).";
