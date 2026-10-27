// Dati iniziali di esempio (stagione 2026/27 dei prototipi). Si eseguono solo su DB vuoto.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { HOME_VENUE as PALACUS } from "../lib/venues";
import * as schema from "./schema";
import { matchSets, matches, players, seasons, standings, teams } from "./schema";

const US = "CUSBros";

const TEAMS = [US, "Volley Castello", "Pol. Zola", "Pallavolo Savena", "Pallavolo Reno", "Budrio Volley", "Vis Imola", "Ozzano Volley"];

/** Parziali già orientati [noi, loro]. */
const MATCHES: { startsAt: string; home: boolean; opponent: string; venue: string; sets?: [number, number][] }[] = [
  { startsAt: "2026-10-11T20:30:00+02:00", home: true, opponent: "Volley Castello", venue: PALACUS, sets: [[25, 21], [23, 25], [25, 19], [25, 22]] },
  { startsAt: "2026-10-18T18:00:00+02:00", home: false, opponent: "Pol. Zola", venue: "Palazzetto Zola Predosa", sets: [[23, 25], [25, 21], [20, 25], [25, 22], [12, 15]] },
  { startsAt: "2026-10-25T20:30:00+01:00", home: true, opponent: "Pallavolo Savena", venue: PALACUS, sets: [[25, 18], [25, 20], [25, 16]] },
  { startsAt: "2026-10-31T21:00:00+01:00", home: false, opponent: "Pallavolo Reno", venue: "Palestra Reno, Casalecchio di Reno" },
  { startsAt: "2026-11-07T20:30:00+01:00", home: true, opponent: "Budrio Volley", venue: PALACUS },
  { startsAt: "2026-11-14T21:00:00+01:00", home: false, opponent: "Vis Imola", venue: "Palestra Ruggi, Imola" },
  { startsAt: "2026-11-21T20:30:00+01:00", home: true, opponent: "Ozzano Volley", venue: PALACUS },
  { startsAt: "2026-11-28T18:00:00+01:00", home: false, opponent: "Volley Castello", venue: "Palazzetto Castel San Pietro" },
  { startsAt: "2026-12-05T20:30:00+01:00", home: true, opponent: "Pol. Zola", venue: PALACUS },
  { startsAt: "2026-12-12T21:00:00+01:00", home: false, opponent: "Pallavolo Savena", venue: "Palestra Savena, San Lazzaro" },
];

/** [squadra, punti, giocate, vinte, perse, set vinti, set persi] */
const STANDINGS: [string, number, number, number, number, number, number][] = [
  ["Pallavolo Reno", 8, 3, 3, 0, 9, 3],
  [US, 7, 3, 2, 1, 8, 4],
  ["Vis Imola", 6, 3, 2, 1, 7, 4],
  ["Budrio Volley", 5, 3, 2, 1, 6, 6],
  ["Pol. Zola", 5, 3, 1, 2, 6, 7],
  ["Ozzano Volley", 3, 3, 1, 2, 4, 7],
  ["Pallavolo Savena", 2, 3, 0, 3, 3, 9],
  ["Volley Castello", 1, 3, 0, 3, 3, 9],
];

const PLAYERS: [number, string, string, (typeof schema.playerRole.enumValues)[number]][] = [
  [7, "Luca", "Bianchi", "P"],
  [54, "Marco", "Rossi", "S"],
  [67, "Andrea", "Conti", "O"],
  [11, "Davide", "Ferri", "C"],
  [30, "Matteo", "Gallo", "S"],
  [4, "Simone", "Neri", "C"],
  [1, "Giorgio", "Riva", "L"],
  [9, "Paolo", "Greco", "S"],
  [18, "Fabio", "Marino", "P"],
  [22, "Nicola", "Villa", "C"],
  [15, "Tommaso", "Leone", "O"],
  [3, "Stefano", "Moro", "L"],
];

type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Restituisce false se il DB contiene già una stagione (non tocca dati esistenti). */
export async function seed(db: AnyDb) {
  const existing = await db.select({ id: seasons.id }).from(seasons).limit(1);
  if (existing.length > 0) return false;

  const [season] = await db.insert(seasons).values({ name: "2026/27", isCurrent: true }).returning();

  const teamRows = await db
    .insert(teams)
    .values(TEAMS.map((name) => ({ name, isUs: name === US })))
    .returning();
  const teamId = (name: string) => {
    const team = teamRows.find((t) => t.name === name);
    if (!team) throw new Error(`Squadra ${name} non nel seed`);
    return team.id;
  };

  const matchRows = await db
    .insert(matches)
    .values(
      MATCHES.map((m, i) => ({
        seasonId: season.id,
        round: i + 1,
        startsAt: new Date(m.startsAt),
        home: m.home,
        opponentId: teamId(m.opponent),
        venue: m.venue,
        status: m.sets ? ("finished" as const) : ("scheduled" as const),
      })),
    )
    .returning();

  await db.insert(matchSets).values(
    MATCHES.flatMap((m, i) => (m.sets ?? []).map(([us, them], n) => ({ matchId: matchRows[i].id, n: n + 1, us, them }))),
  );

  await db.insert(standings).values(
    STANDINGS.map(([team, points, played, won, lost, setsWon, setsLost]) => ({
      seasonId: season.id,
      teamId: teamId(team),
      points,
      played,
      won,
      lost,
      setsWon,
      setsLost,
    })),
  );

  await db.insert(players).values(PLAYERS.map(([number, firstName, lastName, role]) => ({ number, firstName, lastName, role })));

  return true;
}
