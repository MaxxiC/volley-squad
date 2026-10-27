// Tipi ricavati dallo schema Drizzle (src/db/schema.ts).
import type { matchSets, matches, seasons, standings, teams } from "@/db/schema";

export type Season = typeof seasons.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchSet = typeof matchSets.$inferSelect;
export type Standing = typeof standings.$inferSelect;

// Viste con le relazioni già risolte, come le restituisce src/lib/data.ts.

/** Partita con data fissata, avversario e parziali in ordine. */
export type MatchWithDetails = Match & {
  startsAt: Date;
  opponent: Team;
  sets: MatchSet[];
};

export type StandingRow = Standing & {
  team: Team;
};
