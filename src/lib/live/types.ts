// Tipi del Live: eventi (come la tabella `events`, con le date in ISO) e formazioni di set.
import type { PlayerGender, PlayerRole } from "../players";
import type { BallType, Side, Skill } from "./skills";

/**
 * action = azione/punto · sub = cambio · libero = entrata/uscita del libero (non conta come cambio)
 * rotation = rotazione manuale · timeout · correction = correzione del punteggio
 * lineup = formazione di un set successivo · set_end = chiusura del set.
 */
export const EVENT_KINDS = ["action", "sub", "libero", "rotation", "timeout", "correction", "lineup", "set_end"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Fondamentale avversario senza un nostro giocatore: errore o punto dell'avversario. */
export type OppSkill = "opp_error" | "opp_point";

export type EventDetail = {
  /** Errore avversario: su palla semplice o in azione. */
  ballType?: BallType;
  /** Rotazione manuale: avanti (1) o indietro (-1). */
  dir?: 1 | -1;
  /** Cambio / libero: chi entra, chi esce e (cambio) in che ruolo entra. */
  in?: number;
  out?: number;
  role?: PlayerRole;
  /** Timeout: di quale squadra. */
  side?: Side;
  /** Correzione del punteggio: +1 / -1 alla squadra indicata in `point`. */
  delta?: 1 | -1;
  /** Formazione di un set successivo. */
  slots?: number[];
  liberoId?: number | null;
  serveFirst?: Side;
};

export type LiveEvent = {
  id: string;
  setN: number;
  seq: number;
  createdAt: string;
  kind: EventKind;
  playerId: number | null;
  skill: Skill | OppSkill | null;
  outcome: string | null;
  point: Side | null;
  star: boolean;
  /** Punto segnato in modalità semplice senza ancora "come" e "chi". */
  incomplete: boolean;
  /** Annullato: resta nel registro (serve all'offline e al ripristino) ma non conta. */
  deleted: boolean;
  detail: EventDetail | null;
};

export type LiveLineup = {
  setN: number;
  /** P1..P6: id giocatore. */
  slots: number[];
  liberoId: number | null;
  serveFirst: Side;
};

export type LivePlayer = {
  id: number;
  number: number;
  firstName: string;
  lastName: string;
  /** Ruolo in questa partita (da Prepara Live). */
  role: PlayerRole;
  gender: PlayerGender | null;
};
