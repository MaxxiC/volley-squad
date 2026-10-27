// Tipi che rispecchiano il modello dati Postgres (design_handoff_cusbros/README.md → Data model),
// in camelCase. Le date sono stringhe ISO 8601 con offset (timestamptz).

export type Season = {
  id: number;
  name: string;
  isCurrent: boolean;
};

export type Team = {
  id: number;
  name: string;
  isUs: boolean;
};

export type MatchStatus = "scheduled" | "live" | "finished";

export type Match = {
  id: number;
  seasonId: number;
  round: number;
  startsAt: string;
  /** true = giochiamo in casa */
  home: boolean;
  opponentId: number;
  venue: string;
  status: MatchStatus;
  mvpPlayerId: number | null;
};

/** Parziale di un set, già orientato noi/loro. */
export type MatchSet = {
  id: number;
  matchId: number;
  n: number;
  us: number;
  them: number;
};

export type Standing = {
  id: number;
  seasonId: number;
  teamId: number;
  points: number;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
};

// Viste con le relazioni già risolte, come le restituirà il livello dati.

export type MatchWithDetails = Match & {
  opponent: Team;
  sets: MatchSet[];
};

export type StandingRow = Standing & {
  team: Team;
};
