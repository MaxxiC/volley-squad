/** "Casa vs Ospite" con il nostro nome in oro (Calendario pubblico e Admin Partite). */
export function MatchTitle({ home, away, usHome }: { home: string; away: string; usHome: boolean }) {
  return (
    <>
      <span className={usHome ? "text-gold" : "text-ink"}>{home}</span> <span className="font-medium text-faint">vs</span>{" "}
      <span className={usHome ? "text-ink" : "text-gold"}>{away}</span>
    </>
  );
}
