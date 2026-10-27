// Schema Postgres (design_handoff_cusbros/README.md → Data model).
// Dopo ogni modifica: `npm run db:generate` e poi `npm run db:migrate`.
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { PLAYER_GENDERS, PLAYER_ROLES } from "../lib/players";

export const userRole = pgEnum("user_role", ["admin", "coach"]);
/** postponed = rinviata (data da ridefinire). */
export const matchStatus = pgEnum("match_status", ["scheduled", "live", "finished", "postponed"]);
export const matchPhase = pgEnum("match_phase", ["andata", "ritorno"]);
export const playerRole = pgEnum("player_role", PLAYER_ROLES);
export const playerGender = pgEnum("player_gender", PLAYER_GENDERS);
export const eventKind = pgEnum("event_kind", ["action", "sub", "rotation", "set_end"]);
export const eventSkill = pgEnum("event_skill", [
  "serve",
  "reception",
  "set",
  "attack",
  "block",
  "fault",
  "opp_error",
  "opp_point",
]);
export const pointSide = pgEnum("point_side", ["us", "them"]);

export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: userRole().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const seasons = pgTable(
  "seasons",
  {
    id: serial().primaryKey(),
    name: text().notNull(),
    isCurrent: boolean().notNull().default(false),
  },
  // Al massimo una stagione corrente.
  (t) => [uniqueIndex("seasons_one_current").on(t.isCurrent).where(sql`${t.isCurrent}`)],
);

export const teams = pgTable("teams", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  isUs: boolean().notNull().default(false),
});

export const players = pgTable("players", {
  id: serial().primaryKey(),
  number: smallint().notNull(),
  firstName: text().notNull(),
  lastName: text().notNull(),
  /** Ruolo principale: in ogni partita può cambiare (match_players.role). */
  role: playerRole().notNull(),
  /** Facoltativo: serve solo per l'avviso "almeno 2 donne in campo" del misto. */
  gender: playerGender(),
  active: boolean().notNull().default(true),
});

export const matches = pgTable(
  "matches",
  {
    id: serial().primaryKey(),
    seasonId: integer()
      .notNull()
      .references(() => seasons.id),
    /** Giornata dentro la fase: "Ritorno — 1ª giornata" = phase ritorno, round 1. */
    phase: matchPhase().notNull().default("andata"),
    round: smallint().notNull(),
    /** Numero gara del calendario ufficiale (es. "n. 8"). */
    number: smallint(),
    /** null = data da definire (es. "Duplica come ritorno") */
    startsAt: timestamp({ withTimezone: true }),
    /** true = giochiamo in casa */
    home: boolean().notNull(),
    opponentId: integer()
      .notNull()
      .references(() => teams.id),
    venue: text().notNull().default(""),
    status: matchStatus().notNull().default("scheduled"),
    /** Risultato assegnato a tavolino (3–0 d'ufficio): i parziali sono 25–0. */
    forfeit: boolean().notNull().default(false),
    mvpPlayerId: integer().references(() => players.id, { onDelete: "set null" }),
  },
  (t) => [index("matches_season_starts").on(t.seasonId, t.startsAt)],
);

/** Parziali già orientati noi/loro. */
export const matchSets = pgTable(
  "match_sets",
  {
    id: serial().primaryKey(),
    matchId: integer()
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    n: smallint().notNull(),
    us: smallint().notNull(),
    them: smallint().notNull(),
  },
  (t) => [uniqueIndex("match_sets_match_n").on(t.matchId, t.n), check("match_sets_n_range", sql`${t.n} between 1 and 5`)],
);

export const standings = pgTable(
  "standings",
  {
    id: serial().primaryKey(),
    seasonId: integer()
      .notNull()
      .references(() => seasons.id),
    teamId: integer()
      .notNull()
      .references(() => teams.id),
    points: smallint().notNull().default(0),
    played: smallint().notNull().default(0),
    won: smallint().notNull().default(0),
    lost: smallint().notNull().default(0),
    setsWon: smallint().notNull().default(0),
    setsLost: smallint().notNull().default(0),
  },
  (t) => [uniqueIndex("standings_season_team").on(t.seasonId, t.teamId)],
);

/** Presenze. */
export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: integer()
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: integer()
      .notNull()
      .references(() => players.id),
    /** Ruolo in questa partita (proposto: quello principale del giocatore). */
    role: playerRole().notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
);

export const lineups = pgTable(
  "lineups",
  {
    id: serial().primaryKey(),
    matchId: integer()
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setN: smallint().notNull(),
    p1: integer()
      .notNull()
      .references(() => players.id),
    p2: integer()
      .notNull()
      .references(() => players.id),
    p3: integer()
      .notNull()
      .references(() => players.id),
    p4: integer()
      .notNull()
      .references(() => players.id),
    p5: integer()
      .notNull()
      .references(() => players.id),
    p6: integer()
      .notNull()
      .references(() => players.id),
    liberoId: integer().references(() => players.id),
    /** Chi batte per primo in questo set. */
    serveFirst: pointSide().notNull(),
  },
  (t) => [uniqueIndex("lineups_match_set").on(t.matchId, t.setN)],
);

/** Eventi del live. L'id è generato dal client (upsert idempotente anche offline). */
export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey(),
    matchId: integer()
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setN: smallint().notNull(),
    seq: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    kind: eventKind().notNull(),
    playerId: integer().references(() => players.id),
    skill: eventSkill(),
    outcome: text(),
    point: pointSide(),
    star: boolean().notNull().default(false),
    incomplete: boolean().notNull().default(false),
    /** Undo offline: l'evento resta ma non conta. */
    deleted: boolean().notNull().default(false),
    /** Es. { ballType: "free" | "rally" } per errore avversario, { in, out } per i cambi. */
    detail: jsonb(),
  },
  (t) => [index("events_match_set_seq").on(t.matchId, t.setN, t.seq)],
);

export const matchesRelations = relations(matches, ({ one, many }) => ({
  season: one(seasons, { fields: [matches.seasonId], references: [seasons.id] }),
  opponent: one(teams, { fields: [matches.opponentId], references: [teams.id] }),
  sets: many(matchSets),
}));

export const matchSetsRelations = relations(matchSets, ({ one }) => ({
  match: one(matches, { fields: [matchSets.matchId], references: [matches.id] }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  team: one(teams, { fields: [standings.teamId], references: [teams.id] }),
}));
