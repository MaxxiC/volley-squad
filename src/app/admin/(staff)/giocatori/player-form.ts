// Tipi del form giocatore usati dal client. La validazione (zod) è in player-schema.ts.
import type { PlayerGender, PlayerRole } from "@/lib/players";

/** Giocatore con i conteggi della stagione corrente, come lo vede la pagina staff. */
export type AdminPlayer = {
  id: number;
  number: number;
  firstName: string;
  lastName: string;
  role: PlayerRole;
  gender: PlayerGender | null;
  active: boolean;
  presences: number;
  stars: number;
  mvp: number;
};

/** Ciò che l'editor invia a savePlayer: valori grezzi degli input. */
export type PlayerFormInput = {
  id?: number;
  number: string;
  firstName: string;
  lastName: string;
  role: PlayerRole;
  /** "" = non indicato. */
  gender: PlayerGender | "";
  active: boolean;
};
