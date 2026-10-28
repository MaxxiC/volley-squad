// Confronto tra il girone letto dal sito ufficiale e il nostro DB: cosa cambierebbe premendo
// "Applica". Logica pura (i dati del DB arrivano già letti). Regole:
// - squadre riconosciute dall'id ufficiale, poi dal nome (maiuscole e punteggiatura non contano);
//   quelle nuove si creano;
// - le nostre partite si riconoscono dal numero gara, poi da fase + giornata; si aggiornano data,
//   ora, palestra, casa/trasferta, avversario e, se non registrate con il Live, il risultato;
// - le partite registrate con il Live non si toccano mai: un risultato diverso si segnala soltanto;
// - classifica: punti, giocate, vinte e perse come sul sito; set vinti e persi dai parziali.
import { formatShortDate, formatTime, fromRomeInput } from "../format";
import type { OfficialGroup, OfficialMatch } from "./parse";

export type DbTeam = { id: number; name: string; isUs: boolean; officialId: number | null };

export type DbMatch = {
  id: number;
  number: number | null;
  phase: "andata" | "ritorno";
  round: number;
  startsAt: Date | null;
  home: boolean;
  opponentId: number;
  venue: string;
  status: "scheduled" | "live" | "finished" | "postponed";
  sets: { us: number; them: number }[];
  /** Registrata con il Live: risultato e stato non si toccano. */
  recorded: boolean;
};

export type DbStanding = { teamId: number; points: number; played: number; won: number; lost: number; setsWon: number; setsLost: number };

/** Squadra: una nostra (id) o una da creare (con l'id ufficiale). */
export type TeamRef = { teamId: number } | { create: number };

export type MatchValues = {
  number: number;
  phase: "andata" | "ritorno";
  round: number;
  startsAt: Date;
  home: boolean;
  opponent: TeamRef;
  venue: string;
};

export type MatchUpdate = {
  matchId: number;
  label: string;
  changes: string[];
  values: Partial<Omit<MatchValues, "opponent">> & { opponent?: TeamRef };
  /** Risultato da scrivere (partita conclusa) oppure null se non cambia. */
  result: { us: number; them: number }[] | null;
  /** Rinviata con una nuova data: torna "da giocare". */
  reschedule: boolean;
};

export type OfficialPlan = {
  createTeams: { officialId: number; name: string }[];
  linkTeams: { teamId: number; officialId: number }[];
  updates: MatchUpdate[];
  creates: { label: string; values: MatchValues; result: { us: number; them: number }[] | null }[];
  warnings: string[];
  standings: { team: TeamRef; points: number; played: number; won: number; lost: number; setsWon: number; setsLost: number }[];
  standingsChanges: string[];
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Nome di una squadra nuova dal maiuscolo del sito: "O.B.C. VOLLEY" → "O.B.C. Volley" (poi si corregge da Admin se serve). */
export function prettyTeamName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w.includes(".") ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

const when = (d: Date | null) => (d ? `${formatShortDate(d)} ${formatTime(d)}` : "da definire");
const score = (sets: { us: number; them: number }[]) => {
  const us = sets.filter((s) => s.us > s.them).length;
  return `${us}–${sets.length - us} (${sets.map((s) => `${s.us}-${s.them}`).join(" ")})`;
};
const sameSets = (a: { us: number; them: number }[], b: { us: number; them: number }[]) =>
  a.length === b.length && a.every((s, i) => s.us === b[i].us && s.them === b[i].them);

export function planOfficialImport(official: OfficialGroup, db: { teams: DbTeam[]; matches: DbMatch[]; standings: DbStanding[] }, teamName: string): OfficialPlan {
  // --- Squadre ------------------------------------------------------------------------------
  const linkTeams: OfficialPlan["linkTeams"] = [];
  const createTeams: OfficialPlan["createTeams"] = [];
  const refOf = new Map<number, TeamRef>();
  for (const t of official.teams) {
    const found =
      db.teams.find((x) => x.officialId === t.officialId) ??
      db.teams.find((x) => x.officialId === null && (normalize(x.name) === normalize(t.name) || (x.isUs && normalize(t.name) === normalize(teamName))));
    if (found) {
      refOf.set(t.officialId, { teamId: found.id });
      if (found.officialId !== t.officialId) linkTeams.push({ teamId: found.id, officialId: t.officialId });
    } else {
      refOf.set(t.officialId, { create: t.officialId });
      createTeams.push({ officialId: t.officialId, name: prettyTeamName(t.name) });
    }
  }
  const us = db.teams.find((t) => t.isUs);
  const usOfficial = official.teams.find((t) => {
    const ref = refOf.get(t.officialId);
    return ref && "teamId" in ref && ref.teamId === us?.id;
  })?.officialId;
  if (usOfficial === undefined) throw new Error(`Sul sito ufficiale non trovo ${teamName} nel girone`);
  const nameOf = (ref: TeamRef) =>
    "teamId" in ref ? (db.teams.find((t) => t.id === ref.teamId)?.name ?? "?") : (createTeams.find((t) => t.officialId === ref.create)?.name ?? "?");
  const sameRef = (a: TeamRef, b: TeamRef) => ("teamId" in a && "teamId" in b ? a.teamId === b.teamId : "create" in a && "create" in b && a.create === b.create);

  // --- Nostre partite -----------------------------------------------------------------------
  const updates: MatchUpdate[] = [];
  const creates: OfficialPlan["creates"] = [];
  const warnings: string[] = [];
  const used = new Set<number>();
  const ours = official.matches.filter((m) => m.homeId === usOfficial || m.awayId === usOfficial);
  for (const m of ours) {
    const home = m.homeId === usOfficial;
    const opponent = refOf.get(home ? m.awayId : m.homeId)!;
    const startsAt = fromRomeInput(...(m.startsAt.split("T") as [string, string]));
    const result = m.sets.map((s) => (home ? { us: s.home, them: s.away } : { us: s.away, them: s.home }));
    const label = `n. ${m.number} · ${home ? `${teamName} vs ${nameOf(opponent)}` : `${nameOf(opponent)} vs ${teamName}`}`;
    const values: MatchValues = { number: m.number, phase: m.phase, round: m.round, startsAt, home, opponent, venue: m.venue };

    const mine =
      db.matches.find((x) => x.number === m.number && !used.has(x.id)) ??
      db.matches.find((x) => x.phase === m.phase && x.round === m.round && !used.has(x.id) && (x.number === null || x.number === m.number));
    if (!mine) {
      creates.push({ label, values, result: result.length ? result : null });
      continue;
    }
    used.add(mine.id);
    const changes: string[] = [];
    const set: MatchUpdate["values"] = {};
    if (mine.number !== m.number) {
      changes.push(`Numero gara: ${mine.number ?? "—"} → ${m.number}`);
      set.number = m.number;
    }
    if (mine.phase !== m.phase || mine.round !== m.round) {
      changes.push(`Giornata: ${mine.phase} ${mine.round}ª → ${m.phase} ${m.round}ª`);
      set.phase = m.phase;
      set.round = m.round;
    }
    if (mine.startsAt?.getTime() !== startsAt.getTime()) {
      changes.push(`Data: ${when(mine.startsAt)} → ${when(startsAt)}`);
      set.startsAt = startsAt;
    }
    if (mine.home !== home) {
      changes.push(`Campo: ${mine.home ? "casa" : "trasferta"} → ${home ? "casa" : "trasferta"}`);
      set.home = home;
    }
    if (!sameRef({ teamId: mine.opponentId }, opponent)) {
      changes.push(`Avversario: ${nameOf({ teamId: mine.opponentId })} → ${nameOf(opponent)}`);
      set.opponent = opponent;
    }
    if (m.venue && mine.venue !== m.venue) {
      changes.push(`Palestra: ${mine.venue || "—"} → ${m.venue}`);
      set.venue = m.venue;
    }
    let newResult: MatchUpdate["result"] = null;
    if (result.length) {
      if (mine.recorded) {
        if (!sameSets(mine.sets, result)) warnings.push(`${label}: risultato del Live ${score(mine.sets)}, sul sito ufficiale ${score(result)} (non cambiato)`);
      } else if (mine.status !== "finished" || !sameSets(mine.sets, result)) {
        changes.push(`Risultato: ${mine.status === "finished" ? score(mine.sets) : "—"} → ${score(result)}`);
        newResult = result;
      }
    } else if (mine.status === "finished" && !mine.recorded) {
      warnings.push(`${label}: da noi è conclusa (${score(mine.sets)}), sul sito ufficiale non ancora (non cambiata)`);
    }
    const reschedule = mine.status === "postponed" && set.startsAt !== undefined;
    if (reschedule) changes.push("Stato: rinviata → da giocare");
    if (changes.length) updates.push({ matchId: mine.id, label, changes, values: set, result: newResult, reschedule });
  }
  for (const x of db.matches) {
    if (!used.has(x.id)) warnings.push(`Partita n. ${x.number ?? "—"} (${x.phase} ${x.round}ª) non c'è sul sito ufficiale: lasciata com'è`);
  }

  // --- Classifica ---------------------------------------------------------------------------
  const setsOf = new Map<number, { won: number; lost: number }>();
  const add = (id: number, won: number, lost: number) => {
    const s = setsOf.get(id) ?? { won: 0, lost: 0 };
    setsOf.set(id, { won: s.won + won, lost: s.lost + lost });
  };
  for (const m of official.matches as OfficialMatch[]) {
    const home = m.sets.filter((s) => s.home > s.away).length;
    add(m.homeId, home, m.sets.length - home);
    add(m.awayId, m.sets.length - home, home);
  }
  const standings = official.standings.map((s) => ({
    team: refOf.get(s.officialId)!,
    points: s.points,
    played: s.played,
    won: s.won,
    lost: s.lost,
    setsWon: setsOf.get(s.officialId)?.won ?? 0,
    setsLost: setsOf.get(s.officialId)?.lost ?? 0,
  }));
  const standingsChanges = standings.flatMap((s) => {
    const cur = "teamId" in s.team ? db.standings.find((x) => x.teamId === (s.team as { teamId: number }).teamId) : undefined;
    const row = (r: Omit<DbStanding, "teamId">) => `${r.points} pt, ${r.played} G, ${r.won} V, ${r.lost} P, set ${r.setsWon}–${r.setsLost}`;
    if (cur && row(cur) === row(s)) return [];
    return [`${nameOf(s.team)}: ${cur ? row(cur) : "—"} → ${row(s)}`];
  });

  return { createTeams, linkTeams, updates, creates, warnings, standings, standingsChanges };
}

/** Niente da applicare (gli avvisi da soli non cambiano nulla). */
export function planIsEmpty(p: OfficialPlan) {
  return !p.createTeams.length && !p.linkTeams.length && !p.updates.length && !p.creates.length && !p.standingsChanges.length;
}
