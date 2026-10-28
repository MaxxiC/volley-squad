// Tipi del form giocatore usati dal client. La validazione (zod) è in player-schema.ts.
import type { PlayerGender, PlayerRole } from "@/lib/players";
import type { SkillLine, StatSkill } from "@/lib/stats";

/**
 * Statistiche della stagione dalle partite concluse registrate con il Live: in quanti match, con quali
 * ruoli, e le card dei fondamentali per tutti i ruoli ("all") e per ciascun ruolo giocato.
 */
export type PlayerStats = {
  matches: number;
  roles: { role: PlayerRole; matches: number }[];
  lines: Partial<Record<"all" | PlayerRole, SkillLine[]>>;
  /** Partite in ordine di data, per il grafico Andamento: efficienza dei fondamentali con azioni. */
  trend: TrendMatch[];
};

export type TrendMatch = {
  /** Etichetta corta sull'asse: "A2" (andata 2ª), "R3". */
  label: string;
  /** Per la lettura del punto: "Andata 2ª · vs Ghedauto · Mer 28 ott". */
  title: string;
  role: PlayerRole;
  skills: Partial<Record<StatSkill, { eff: number; total: number }>>;
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
