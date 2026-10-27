// Dati finti strutturati come le tabelle Postgres. Usati finché lo step 2 non collega Neon + Drizzle.
import type { Match, MatchSet, Season, Standing, Team } from "./types";

export const seasons: Season[] = [{ id: 1, name: "2026/27", isCurrent: true }];

export const teams: Team[] = [
  { id: 1, name: "CUSBros", isUs: true },
  { id: 2, name: "Volley Castello", isUs: false },
  { id: 3, name: "Pol. Zola", isUs: false },
  { id: 4, name: "Pallavolo Savena", isUs: false },
  { id: 5, name: "Pallavolo Reno", isUs: false },
  { id: 6, name: "Budrio Volley", isUs: false },
  { id: 7, name: "Vis Imola", isUs: false },
  { id: 8, name: "Ozzano Volley", isUs: false },
];

const PALACUS = "PalaCUS, Bologna";

export const matches: Match[] = [
  { id: 1, seasonId: 1, round: 1, startsAt: "2026-10-11T20:30:00+02:00", home: true, opponentId: 2, venue: PALACUS, status: "finished", mvpPlayerId: null },
  { id: 2, seasonId: 1, round: 2, startsAt: "2026-10-18T18:00:00+02:00", home: false, opponentId: 3, venue: "Palazzetto Zola Predosa", status: "finished", mvpPlayerId: null },
  { id: 3, seasonId: 1, round: 3, startsAt: "2026-10-25T20:30:00+01:00", home: true, opponentId: 4, venue: PALACUS, status: "finished", mvpPlayerId: null },
  { id: 4, seasonId: 1, round: 4, startsAt: "2026-10-31T21:00:00+01:00", home: false, opponentId: 5, venue: "Palestra Reno, Casalecchio di Reno", status: "scheduled", mvpPlayerId: null },
  { id: 5, seasonId: 1, round: 5, startsAt: "2026-11-07T20:30:00+01:00", home: true, opponentId: 6, venue: PALACUS, status: "scheduled", mvpPlayerId: null },
  { id: 6, seasonId: 1, round: 6, startsAt: "2026-11-14T21:00:00+01:00", home: false, opponentId: 7, venue: "Palestra Ruggi, Imola", status: "scheduled", mvpPlayerId: null },
  { id: 7, seasonId: 1, round: 7, startsAt: "2026-11-21T20:30:00+01:00", home: true, opponentId: 8, venue: PALACUS, status: "scheduled", mvpPlayerId: null },
  { id: 8, seasonId: 1, round: 8, startsAt: "2026-11-28T18:00:00+01:00", home: false, opponentId: 2, venue: "Palazzetto Castel San Pietro", status: "scheduled", mvpPlayerId: null },
  { id: 9, seasonId: 1, round: 9, startsAt: "2026-12-05T20:30:00+01:00", home: true, opponentId: 3, venue: PALACUS, status: "scheduled", mvpPlayerId: null },
  { id: 10, seasonId: 1, round: 10, startsAt: "2026-12-12T21:00:00+01:00", home: false, opponentId: 4, venue: "Palestra Savena, San Lazzaro", status: "scheduled", mvpPlayerId: null },
];

export const matchSets: MatchSet[] = [
  { id: 1, matchId: 1, n: 1, us: 25, them: 21 },
  { id: 2, matchId: 1, n: 2, us: 23, them: 25 },
  { id: 3, matchId: 1, n: 3, us: 25, them: 19 },
  { id: 4, matchId: 1, n: 4, us: 25, them: 22 },
  { id: 5, matchId: 2, n: 1, us: 23, them: 25 },
  { id: 6, matchId: 2, n: 2, us: 25, them: 21 },
  { id: 7, matchId: 2, n: 3, us: 20, them: 25 },
  { id: 8, matchId: 2, n: 4, us: 25, them: 22 },
  { id: 9, matchId: 2, n: 5, us: 12, them: 15 },
  { id: 10, matchId: 3, n: 1, us: 25, them: 18 },
  { id: 11, matchId: 3, n: 2, us: 25, them: 20 },
  { id: 12, matchId: 3, n: 3, us: 25, them: 16 },
];

export const standings: Standing[] = [
  { id: 1, seasonId: 1, teamId: 5, points: 8, played: 3, won: 3, lost: 0, setsWon: 9, setsLost: 3 },
  { id: 2, seasonId: 1, teamId: 1, points: 7, played: 3, won: 2, lost: 1, setsWon: 8, setsLost: 4 },
  { id: 3, seasonId: 1, teamId: 7, points: 6, played: 3, won: 2, lost: 1, setsWon: 7, setsLost: 4 },
  { id: 4, seasonId: 1, teamId: 6, points: 5, played: 3, won: 2, lost: 1, setsWon: 6, setsLost: 6 },
  { id: 5, seasonId: 1, teamId: 3, points: 5, played: 3, won: 1, lost: 2, setsWon: 6, setsLost: 7 },
  { id: 6, seasonId: 1, teamId: 8, points: 3, played: 3, won: 1, lost: 2, setsWon: 4, setsLost: 7 },
  { id: 7, seasonId: 1, teamId: 4, points: 2, played: 3, won: 0, lost: 3, setsWon: 3, setsLost: 9 },
  { id: 8, seasonId: 1, teamId: 2, points: 1, played: 3, won: 0, lost: 3, setsWon: 3, setsLost: 9 },
];
