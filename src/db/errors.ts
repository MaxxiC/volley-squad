/** Postgres 23503: riga ancora referenziata, o riferimento a una riga che non esiste. */
export function isForeignKeyViolation(err: unknown): boolean {
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23503") return true;
  }
  return false;
}
