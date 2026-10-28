// Tipi del form giocatore usati dal client. La validazione (zod) è in player-schema.ts.
import type { PlayerGender, PlayerRole } from "@/lib/players";
import type { SkillLine } from "@/lib/stats";

/**
 * Statistiche della stagione dalle partite concluse registrate con il Live: in quanti match, con quali
 * ruoli, e le card dei fondamentali per tutti i ruoli ("all") e per ciascun ruolo giocato.
 */
export type PlayerStats = {
  matches: number;
  roles: { role: PlayerRole; matches: number }[];
  lines: Partial<Record<"all" | PlayerRole, SkillLine[]>>;
};

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
  stats: PlayerStats;
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
