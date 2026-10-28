import { eq } from "drizzle-orm";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Utente staff della richiesta, o null. La sessione è un JWT valido 30 giorni: oltre alla firma si
 * controlla che l'utente esista ancora, così chi viene eliminato perde l'accesso subito (non alla
 * scadenza del token). Una sola lettura per richiesta.
 */
export const currentStaff = cache(async () => {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!session?.user || !Number.isInteger(id)) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true } });
  return user ? session.user : null;
});

/**
 * Da chiamare all'inizio di ogni server action dell'area staff: le action sono endpoint
 * pubblici e non vanno lasciate protette solo dal middleware.
 */
export async function requireStaff() {
  const user = await currentStaff();
  if (!user) throw new Error("Non autorizzato");
  return user;
}
