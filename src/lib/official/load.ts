// Import dal sito ufficiale, parte server: scarica la pagina del comitato e legge lo stato del
// nostro DB per il confronto (diff.ts). La pagina si scarica solo quando lo chiede lo staff.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { events, matchSets, matches, standings, teams } from "@/db/schema";
import { OFFICIAL_CALENDAR_URL, OFFICIAL_GROUP, TEAM_NAME } from "../club";
import { planOfficialImport, type DbMatch } from "./diff";
import { parseOfficialGroup } from "./parse";

export async function fetchOfficialGroup() {
  const res = await fetch(OFFICIAL_CALENDAR_URL, {
    cache: "no-store",
    headers: { "User-Agent": `${TEAM_NAME} (sito della squadra, aggiornamento manuale)` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) throw new Error("Il sito ufficiale non risponde: riprova tra poco");
  return parseOfficialGroup(await res.text(), OFFICIAL_GROUP);
}

/** Squadre, nostre partite della stagione (con risultato e se registrate col Live) e classifica. */
export async function loadDbState(seasonId: number) {
  const [teamRows, matchRows, standingRows] = await Promise.all([
    db.select().from(teams),
    db.select().from(matches).where(eq(matches.seasonId, seasonId)),
    db.select().from(standings).where(eq(standings.seasonId, seasonId)),
  ]);
  const ids = matchRows.map((m) => m.id);
  const [setRows, recorded] = ids.length
    ? await Promise.all([
        db.select().from(matchSets).where(inArray(matchSets.matchId, ids)),
        db.selectDistinct({ matchId: events.matchId }).from(events).where(and(inArray(events.matchId, ids), eq(events.kind, "action"))),
      ])
    : [[], []];
  const withEvents = new Set(recorded.map((r) => r.matchId));
  const dbMatches: DbMatch[] = matchRows.map((m) => ({
    id: m.id,
    number: m.number,
    phase: m.phase,
    round: m.round,
    startsAt: m.startsAt,
    home: m.home,
    opponentId: m.opponentId,
    venue: m.venue,
    status: m.status,
    sets: setRows.filter((s) => s.matchId === m.id).sort((a, b) => a.n - b.n).map((s) => ({ us: s.us, them: s.them })),
    recorded: withEvents.has(m.id),
    friendly: m.friendly,
  }));
  return { teams: teamRows, matches: dbMatches, standings: standingRows };
}

/** Cosa cambierebbe applicando il sito ufficiale (nessuna scrittura). */
export async function officialPlan(seasonId: number) {
  const [official, state] = await Promise.all([fetchOfficialGroup(), loadDbState(seasonId)]);
  return planOfficialImport(official, state, TEAM_NAME);
}
