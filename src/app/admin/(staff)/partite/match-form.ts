// Tipi e costanti del form partita usati dal client. La validazione (zod) è in match-schema.ts,
// importata solo dalle server action, così zod non finisce nel bundle del browser.

/** Partita come la vede l'editor: date e ore già nel formato degli input, ora italiana. */
export type AdminMatch = {
  id: number;
  phase: "andata" | "ritorno";
  round: number;
  number: number | null;
  date: string;
  time: string;
  /** Box data della lista ("28" / "ott"); null = data da definire. */
  box: { day: string; month: string } | null;
  home: boolean;
  opponent: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  sets: { us: number; them: number }[];
};

export type SetSlot = { us: string; them: string };

export const SET_SLOTS = 5;

/** Ciò che l'editor invia a saveMatch: valori grezzi degli input. */
export type MatchFormInput = {
  id?: number;
  phase: "andata" | "ritorno";
  round: string;
  number: string;
  date: string;
  time: string;
  home: boolean;
  opponent: string;
  venue: string;
  slots: SetSlot[];
};
