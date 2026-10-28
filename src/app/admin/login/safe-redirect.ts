// Dove andare dopo il login: solo percorsi interni all'area staff (niente redirect verso altri siti).
import { ADMIN_HOME, LOGIN_PATH } from "@/auth.config";

export function safeRedirect(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw) return ADMIN_HOME;
  const url = new URL(raw, "http://localhost");
  // Un indirizzo assoluto o "//altro-sito" cambia host: si torna all'area staff.
  if (url.origin !== "http://localhost") return ADMIN_HOME;
  return url.pathname.startsWith("/admin/") && url.pathname !== LOGIN_PATH ? url.pathname + url.search : ADMIN_HOME;
}
