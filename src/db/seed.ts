// Dati iniziali: Libertas Cup Mix 2027, girone Challenge (calendario ufficiale SportAdmin al 27/10/2026).
// Si eseguono solo su DB vuoto. La rosa è ancora quella di esempio dei prototipi.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { HOME_VENUE } from "../lib/club";
import { fromRomeInput } from "../lib/format";
import * as schema from "./schema";
import { matchSets, matches, players, seasons, standings, teams } from "./schema";

const US = "CUSBros";
const HOME_A = "Palestra ITIG O. BELLUZZI-L. DA VINCI - CAMPO A — Rimini (RN)";

const TEAMS = [
  US,
  "Acerboli Volley",
  "Dinamite",
  "Drink Team",
  "Ghedauto Iveco Volley CUSB",
  "Misano Volley",
  "O.B.C. Volley",
  "Re Start Volley",
  "Santarcangelo Volley",
  "Squadra Tre",
  "Stordyteam",
];

type SeedMatch = {
  phase: "andata" | "ritorno";
  round: number;
  number: number;
  date: string;
  time: string;
  home: boolean;
  opponent: string;
  venue: string;
  /** Parziali già orientati [noi, loro]. */
  sets?: [number, number][];
};

// Le partite di CUSBros (la 7ª giornata di andata e di ritorno riposiamo).
const MATCHES: SeedMatch[] = [
  { phase: "andata", round: 1, number: 3, date: "2026-10-21", time: "21:15", home: true, opponent: "Stordyteam", venue: HOME_A, sets: [[25, 16], [25, 18], [25, 18]] },
  { phase: "andata", round: 2, number: 8, date: "2026-10-28", time: "21:30", home: true, opponent: "Ghedauto Iveco Volley CUSB", venue: HOME_VENUE },
  { phase: "andata", round: 3, number: 15, date: "2027-04-05", time: "20:30", home: true, opponent: "Re Start Volley", venue: HOME_VENUE },
  { phase: "andata", round: 4, number: 18, date: "2026-11-09", time: "21:30", home: false, opponent: "Acerboli Volley", venue: "PALESTRA COMUNALE — Poggio Torriana (RN)" },
  { phase: "andata", round: 5, number: 22, date: "2026-11-18", time: "21:00", home: false, opponent: "Squadra Tre", venue: "ITC Gobetti — Morciano di Romagna (RN)" },
  { phase: "andata", round: 6, number: 28, date: "2026-11-25", time: "21:30", home: true, opponent: "Drink Team", venue: HOME_VENUE },
  { phase: "andata", round: 8, number: 39, date: "2026-12-10", time: "20:30", home: false, opponent: "O.B.C. Volley", venue: "ITC Gobetti — Morciano di Romagna (RN)" },
  { phase: "andata", round: 9, number: 44, date: "2026-12-16", time: "21:30", home: true, opponent: "Misano Volley", venue: HOME_VENUE },
  { phase: "andata", round: 10, number: 46, date: "2026-10-29", time: "21:40", home: false, opponent: "Dinamite", venue: "PALESTRA SCUOLA MEDIA PANZINI — Bellaria-Igea Marina (RN)" },
  { phase: "andata", round: 11, number: 54, date: "2027-01-20", time: "21:30", home: true, opponent: "Santarcangelo Volley", venue: HOME_VENUE },
  { phase: "ritorno", round: 1, number: 58, date: "2027-01-27", time: "21:30", home: false, opponent: "Stordyteam", venue: "Sc. Elem. Villaggio 1° Maggio — Rimini (RN)" },
  { phase: "ritorno", round: 2, number: 63, date: "2027-02-05", time: "21:30", home: false, opponent: "Ghedauto Iveco Volley CUSB", venue: HOME_VENUE },
  { phase: "ritorno", round: 3, number: 70, date: "2027-02-10", time: "21:30", home: false, opponent: "Re Start Volley", venue: "PALLONE SCUOLA DON MILANI — Coriano (RN)" },
  { phase: "ritorno", round: 4, number: 73, date: "2027-02-17", time: "21:30", home: true, opponent: "Acerboli Volley", venue: HOME_VENUE },
  { phase: "ritorno", round: 5, number: 77, date: "2027-02-24", time: "21:30", home: true, opponent: "Squadra Tre", venue: HOME_VENUE },
  { phase: "ritorno", round: 6, number: 83, date: "2027-03-03", time: "21:15", home: false, opponent: "Drink Team", venue: "PALESTRA FELLINI — Rimini (RN)" },
  { phase: "ritorno", round: 8, number: 94, date: "2027-03-17", time: "21:30", home: true, opponent: "O.B.C. Volley", venue: HOME_VENUE },
  { phase: "ritorno", round: 9, number: 99, date: "2027-03-25", time: "21:00", home: false, opponent: "Misano Volley", venue: "PALASPORT ROSSINI — Misano Adriatico (RN)" },
  { phase: "ritorno", round: 10, number: 101, date: "2027-04-07", time: "21:30", home: true, opponent: "Dinamite", venue: HOME_VENUE },
  { phase: "ritorno", round: 11, number: 109, date: "2027-04-16", time: "21:00", home: false, opponent: "Santarcangelo Volley", venue: "PALESTRA ITC MOLARI - CAMPO A — Santarcangelo di Romagna (RN)" },
];

/** [squadra, punti, vinte, perse, set vinti, set persi]; set ricavati dai risultati ufficiali. */
const STANDINGS: [string, number, number, number, number, number][] = [
  [US, 3, 1, 0, 3, 0],
  ["O.B.C. Volley", 3, 1, 0, 3, 1],
  ["Misano Volley", 2, 1, 0, 3, 2],
  ["Dinamite", 1, 0, 1, 2, 3],
  ["Acerboli Volley", 0, 0, 0, 0, 0],
  ["Drink Team", 0, 0, 0, 0, 0],
  ["Ghedauto Iveco Volley CUSB", 0, 0, 0, 0, 0],
  ["Re Start Volley", 0, 0, 0, 0, 0],
  ["Squadra Tre", 0, 0, 0, 0, 0],
  ["Santarcangelo Volley", 0, 0, 1, 1, 3],
  ["Stordyteam", 0, 0, 1, 0, 3],
];

// Rosa di esempio (prototipi): da sostituire con quella vera.
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
      MATCHES.map((m) => ({
        seasonId: season.id,
        phase: m.phase,
        round: m.round,
        number: m.number,
        startsAt: fromRomeInput(m.date, m.time),
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
    STANDINGS.map(([team, points, won, lost, setsWon, setsLost]) => ({
      seasonId: season.id,
      teamId: teamId(team),
      points,
      played: won + lost,
      won,
      lost,
      setsWon,
      setsLost,
    })),
  );

  await db.insert(players).values(PLAYERS.map(([number, firstName, lastName, role]) => ({ number, firstName, lastName, role })));

  return true;
}
