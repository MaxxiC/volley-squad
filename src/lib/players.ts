// Ruoli e nomi dei giocatori, condivisi da admin, Live e pagine pubbliche.

export const PLAYER_ROLES = ["P", "S", "O", "C", "L"] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

/** Nomi dei ruoli come li usa la squadra ("banda" = schiacciatore). */
export const ROLE_LABEL: Record<PlayerRole, string> = {
  P: "Alzatore",
  S: "Banda",
  O: "Opposto",
  C: "Centrale",
  L: "Libero",
};

export const PLAYER_GENDERS = ["F", "M"] as const;
export type PlayerGender = (typeof PLAYER_GENDERS)[number];

/** Sesso: facoltativo, serve solo per l'avviso del misto (almeno 2 donne in campo). */
export const GENDER_LABEL: Record<PlayerGender, string> = { F: "Donna", M: "Uomo" };

type Named = { firstName: string; lastName: string };

/** "Micol Capelli", oppure solo "Claudio" se il cognome manca. */
export function fullName(p: Named) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

/** Nome breve per griglie e campo del Live: cognome, o il nome se il cognome manca. */
export function shortName(p: Named) {
  return p.lastName || p.firstName;
}
