/** Etichetta oro sopra le card ("Prossima partita", "Classifica", ...). */
export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[15px] font-bold tracking-[.24em] text-gold uppercase">{children}</span>
  );
}
