import { auth } from "@/auth";

/**
 * Da chiamare all'inizio di ogni server action dell'area staff: le action sono endpoint
 * pubblici e non vanno lasciate protette solo dal middleware.
 */
export async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorizzato");
  return session.user;
}
