import type { Match } from "@/lib/types";

// Tipi e costanti del form partita usati dal client. La validazione (zod) è in match-schema.ts,
// importata solo dalle server action, così zod non finisce nel bundle del browser.

/** Partita come la vede l'editor: date e ore già nel formato degli input, ora italiana. */
export type AdminMatch = {
  id: number;
  friendly: boolean;
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
  status: Match["status"];
  forfeit: boolean;
  sets: { us: number; them: number }[];
};

/** Situazioni particolari di una partita, scelte nell'editor al posto dei parziali. */
export const SPECIAL_LABEL = {
  none: "Normale",
  postponed: "Rinviata",
  forfeit_won: "Vinta a tavolino (3–0)",
  forfeit_lost: "Persa a tavolino (0–3)",
} as const;

export type MatchSpecial = keyof typeof SPECIAL_LABEL;

export const MATCH_SPECIALS = Object.keys(SPECIAL_LABEL) as [MatchSpecial, ...MatchSpecial[]];

export function specialOf(m: Pick<AdminMatch, "status" | "forfeit" | "sets">): MatchSpecial {
  if (m.status === "postponed") return "postponed";
  if (m.forfeit) return m.sets[0] && m.sets[0].us > m.sets[0].them ? "forfeit_won" : "forfeit_lost";
  return "none";
}

export type SetSlot = { us: string; them: string };

export const SET_SLOTS = 5;

/** Ciò che l'editor invia a saveMatch: valori grezzi degli input. */
export type MatchFormInput = {
  id?: number;
  /** Amichevole: fase, giornata e numero gara non servono. */
  friendly: boolean;
  phase: "andata" | "ritorno";
  round: string;
  number: string;
  date: string;
  time: string;
  home: boolean;
  opponent: string;
  venue: string;
  special: MatchSpecial;
  slots: SetSlot[];
};
