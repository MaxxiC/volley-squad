// Tipi dell'import dal sito ufficiale usati dal client (le action sono in actions.ts).

/** Cosa cambierebbe (o è cambiato) applicando il sito ufficiale, in testi già pronti. */
export type OfficialSummary = {
  createTeams: string[];
  linkTeams: number;
  updates: { label: string; changes: string[] }[];
  creates: string[];
  warnings: string[];
  standings: string[];
  /** Niente da applicare (gli avvisi non cambiano nulla). */
  empty: boolean;
};
