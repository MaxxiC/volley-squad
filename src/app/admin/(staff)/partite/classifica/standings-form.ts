// Tipi e costanti della classifica modificabile usati dal client. La validazione (zod) è in
// standings-schema.ts, importata solo dalla server action.

/** Riga come la vede l'editor: numeri come stringhe degli input. */
export type StandingDraft = {
  key: string;
  team: string;
  points: string;
  won: string;
  lost: string;
  setsWon: string;
  setsLost: string;
};

/** Ciò che l'editor invia a saveStandings. */
export type StandingsInput = Omit<StandingDraft, "key">[];

export const STAT_FIELDS = [
  { key: "points", label: "Pt" },
  { key: "won", label: "V" },
  { key: "lost", label: "P" },
  { key: "setsWon", label: "SV" },
  { key: "setsLost", label: "SP" },
] as const;
