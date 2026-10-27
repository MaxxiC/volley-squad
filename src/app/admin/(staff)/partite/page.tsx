import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { matches, teams } from "@/db/schema";
import { getCurrentSeason } from "@/lib/data";
import { dateBox, toDateInput, toTimeInput } from "@/lib/format";
import type { AdminMatch } from "./match-form";
import { MatchesManager } from "./matches-manager";

export const metadata: Metadata = { title: "Partite" };

const DEFAULT_TIMES = ["18:00", "20:30", "21:00"];

/** I 3 orari più usati (a parità vince quello di default), in ordine di ora. */
function frequentTimes(times: string[]) {
  const count = new Map<string, number>();
  for (const t of times) count.set(t, (count.get(t) ?? 0) + 1);
  for (const t of DEFAULT_TIMES) count.set(t, (count.get(t) ?? 0) + 0.5);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)
    .sort();
}

export default async function PartitePage() {
  const season = await getCurrentSeason();
  const [rows, opponents] = await Promise.all([
    db.query.matches.findMany({
      where: eq(matches.seasonId, season.id),
      // Postgres mette le date nulle in fondo: le partite "da definire" chiudono la lista.
      orderBy: [asc(matches.startsAt), asc(matches.round)],
      with: { opponent: true, sets: { orderBy: (s, { asc }) => [asc(s.n)] } },
    }),
    db.query.teams.findMany({ where: eq(teams.isUs, false), orderBy: [asc(teams.name)] }),
  ]);

  const list: AdminMatch[] = rows.map((m) => ({
    id: m.id,
    phase: m.phase,
    round: m.round,
    number: m.number,
    date: m.startsAt ? toDateInput(m.startsAt) : "",
    time: m.startsAt ? toTimeInput(m.startsAt) : "",
    box: m.startsAt ? dateBox(m.startsAt) : null,
    home: m.home,
    opponent: m.opponent.name,
    venue: m.venue,
    status: m.status,
    sets: m.sets.map((s) => ({ us: s.us, them: s.them })),
  }));

  const venues = [...new Set(list.map((m) => m.venue).filter(Boolean))].sort();

  return (
    <MatchesManager
      seasonName={season.name}
      matches={list}
      opponents={opponents.map((t) => t.name)}
      venues={venues}
      timeChips={frequentTimes(list.map((m) => m.time).filter(Boolean))}
    />
  );
}
