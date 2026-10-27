// Tipi del Live: eventi (come la tabella `events`, con le date in ISO) e formazioni di set.
import type { BallType, Side, Skill } from "./skills";

export type EventKind = "action" | "sub" | "rotation" | "set_end";

/** Fondamentale avversario senza un nostro giocatore: errore o punto dell'avversario. */
export type OppSkill = "opp_error" | "opp_point";

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
  detail: { ballType?: BallType; dir?: 1 | -1 } | null;
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
  role: string;
};
