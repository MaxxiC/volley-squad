// Tipi del wizard Prepara Live usati dal client. La validazione (zod) è in prepare-schema.ts.
import type { PlayerGender, PlayerRole } from "@/lib/players";

export type PreparePlayer = {
  id: number;
  number: number;
  firstName: string;
  lastName: string;
  role: PlayerRole;
  gender: PlayerGender | null;
};

/** Presenti + formazione di una partita (precedente o già preparata), per le scorciatoie. */
export type PrepareSetup = {
  present: { playerId: number; role: PlayerRole }[];
  /** P1..P6; null = posizione non disponibile (giocatore non più in rosa). */
  slots: (number | null)[];
  liberoId: number | null;
};

/** Ciò che il wizard invia a startMatch. */
export type StartMatchInput = {
  matchId: number;
  present: { playerId: number; role: PlayerRole }[];
  slots: number[];
  liberoId: number | null;
  serveFirst: "us" | "them";
};

export type LiveMode = "semplice" | "avanzato";

/** Modalità scelta in Prepara Live e letta dal Live; vive solo su questo telefono. */
export const LIVE_MODE_KEY = "cusbros:live-mode";
