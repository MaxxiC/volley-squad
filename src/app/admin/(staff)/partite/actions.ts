"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, runBatch } from "@/db";
import { matchSets, matches } from "@/db/schema";
import { invalid, revalidatePublicPages, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/lib/auth-guard";
import { HOME_VENUE, TEAM_NAME } from "@/lib/club";
import { getCurrentSeason } from "@/lib/data";
import { fromRomeInput } from "@/lib/format";
import { matchScore } from "@/lib/matches";
import { findOrCreateTeam } from "@/lib/teams";
import type { MatchFormInput } from "./match-form";
import { MatchFormSchema } from "./match-schema";

type MatchResult = ActionResult<{ id: number }>;

const NOT_FOUND = { ok: false, error: "Partita non trovata, ricarica la pagina" } as const;

function revalidateMatches() {
  revalidatePublicPages();
  revalidatePath("/admin/partite");
}

export async function saveMatch(input: MatchFormInput): Promise<MatchResult> {
  await requireStaff();
  const parsed = MatchFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, sets, date, time, opponent: opponentName, ...rest } = parsed.data;

  const opponent = await findOrCreateTeam(opponentName);
  if (opponent.isUs) return { ok: false, error: `L'avversario non può essere ${TEAM_NAME}` };

  const fields = { ...rest, opponentId: opponent.id, startsAt: date ? fromRomeInput(date, time) : null };
  const played = matchScore(sets).over ? "finished" : "scheduled";

  let matchId: number;
  if (id) {
    const current = await db.query.matches.findFirst({ where: eq(matches.id, id) });
    if (!current) return NOT_FOUND;
    matchId = current.id;
    // Una partita in corso nel Live resta "live": la chiude il Live.
    await db
      .update(matches)
      .set({ ...fields, status: current.status === "live" ? "live" : played })
      .where(eq(matches.id, matchId));
  } else {
    const season = await getCurrentSeason();
    const [created] = await db
      .insert(matches)
      .values({ ...fields, seasonId: season.id, status: played })
      .returning({ id: matches.id });
    matchId = created.id;
  }

  // Parziali riscritti in blocco, in un'unica transazione.
  await runBatch([
    db.delete(matchSets).where(eq(matchSets.matchId, matchId)),
    ...(sets.length ? [db.insert(matchSets).values(sets.map((s, i) => ({ matchId, n: i + 1, ...s })))] : []),
  ]);

  revalidateMatches();
  return { ok: true, id: matchId };
}

export async function deleteMatch(id: number): Promise<MatchResult> {
  await requireStaff();
  // Parziali, presenze, formazioni ed eventi si cancellano a cascata.
  const deleted = await db.delete(matches).where(eq(matches.id, id)).returning({ id: matches.id });
  if (!deleted.length) return NOT_FOUND;
  revalidateMatches();
  return { ok: true, id };
}

/**
 * Crea il ritorno: stessa giornata nell'altra fase (andata 2ª → ritorno 2ª), stesso avversario,
 * casa/trasferta invertite, data e numero gara da definire.
 */
export async function duplicateAsReturn(id: number): Promise<MatchResult> {
  await requireStaff();
  const source = await db.query.matches.findFirst({ where: eq(matches.id, id) });
  if (!source) return NOT_FOUND;

  const home = !source.home;
  const [created] = await db
    .insert(matches)
    .values({
      seasonId: source.seasonId,
      phase: source.phase === "andata" ? "ritorno" : "andata",
      round: source.round,
      startsAt: null,
      home,
      opponentId: source.opponentId,
      venue: home ? HOME_VENUE : "",
    })
    .returning({ id: matches.id });

  revalidateMatches();
  return { ok: true, id: created.id };
}
