// Statistiche di più partite (pagina pubblica Statistiche): i numeri di ogni partita registrata col
// Live e la loro somma per la stagione o per la partita scelta. Logica pura, anche lato client.
import { SPLIT_LABEL, pointSplit, type SplitKey } from "./match-report";
import { OPP_ERRORS } from "./live/skills";
import { computeLive } from "./live/state";
import type { LiveEvent, LiveLineup } from "./live/types";
import type { PlayerRole } from "./players";
import {
  GIVEN_LABEL,
  countsByPlayer,
  emptyCounts,
  matchRoles,
  mergeCounts,
  mergePlayingTime,
  oppErrorSplit,
  playingTime,
  pointsAndErrors,
  pointsGiven,
  type Counts,
  type PlayingTime,
} from "./stats";

/** Numeri di un giocatore in una partita. */
export type PlayerMatchStat = {
  role: PlayerRole;
  counts: Counts;
  time: PlayingTime;
  points: number;
  errors: number;
  stars: number;
};

export type Split = { key: string; label: string; value: number };

/** Numeri di una partita: per giocatore (chi era tra i presenti o è entrato con un cambio) e di squadra. */
export type MatchStat = {
  id: number;
  /** "A3", "R1": per il filtro e le tabelle. */
  label: string;
  /** "Andata 3ª · vs Dinamite · 21 ott". */
  title: string;
  /** Set vinti–persi, es. "3–1". */
  result: string;
  won: boolean;
  players: Record<number, PlayerMatchStat>;
  /** Come abbiamo fatto punto. */
  scored: Split[];
  /** Errori dell'avversario per tipo. */
  oppErrors: Split[];
  /** Come l'avversario ha fatto punto. */
  given: Split[];
};

const NO_TIME: PlayingTime = { rallies: 0, sets: 0, fullSets: 0 };

/**
 * Numeri di una partita dal suo registro. `present` = presenti di Prepara Live col ruolo di quel
 * giorno: servono anche al libero automatico, così "chi era in campo" è quello vero.
 */
export function matchStat(
  meta: Pick<MatchStat, "id" | "label" | "title" | "result" | "won">,
  lineups: LiveLineup[],
  events: LiveEvent[],
  present: { playerId: number; role: PlayerRole }[],
): MatchStat {
  const roles = matchRoles(present, events);
  const base = new Map(present.map((p) => [p.playerId, p.role]));
  const live = computeLive(lineups, events, (id) => base.get(id));
  const time = playingTime(live?.rallies ?? []);
  const counts = countsByPlayer(events);
  const scores = pointsAndErrors(events);
  const players: Record<number, PlayerMatchStat> = {};
  for (const [id, role] of roles) {
    players[id] = {
      role,
      counts: counts.get(id) ?? emptyCounts(),
      time: time.get(id) ?? NO_TIME,
      points: scores.get(id)?.points ?? 0,
      errors: scores.get(id)?.errors ?? 0,
      stars: events.filter((e) => !e.deleted && e.playerId === id && e.star).length,
    };
  }
  return { ...meta, players, scored: pointSplit(events), oppErrors: oppErrorSplit(events), given: pointsGiven(events) };
}

/** Totali di un giocatore su più partite. */
export type PlayerTotals = {
  playerId: number;
  /** Partite con lui tra i presenti (o entrato con un cambio). */
  matches: number;
  /** Ruoli giocati, dal più frequente. */
  roles: { role: PlayerRole; matches: number }[];
  counts: Counts;
  time: PlayingTime;
  points: number;
  errors: number;
  stars: number;
};

/** Somma voci con la stessa chiave, nell'ordine dato; le voci a zero si tolgono. */
function sumSplits(lists: Split[][], order: { key: string; label: string }[]): Split[] {
  const n = new Map<string, number>();
  for (const list of lists) for (const s of list) n.set(s.key, (n.get(s.key) ?? 0) + s.value);
  return order.filter((o) => n.get(o.key)).map((o) => ({ ...o, value: n.get(o.key) ?? 0 }));
}

const labels = (rec: Record<string, string>) => Object.entries(rec).map(([key, label]) => ({ key, label }));

/** Somma di più partite: giocatori (in ordine di punti fatti) e squadra. */
export function sumMatches(list: MatchStat[]) {
  const byPlayer = new Map<number, PlayerMatchStat[]>();
  for (const m of list) {
    for (const [id, p] of Object.entries(m.players)) byPlayer.set(Number(id), [...(byPlayer.get(Number(id)) ?? []), p]);
  }
  const players: PlayerTotals[] = [...byPlayer].map(([playerId, rows]) => {
    const roleCount = new Map<PlayerRole, number>();
    for (const r of rows) roleCount.set(r.role, (roleCount.get(r.role) ?? 0) + 1);
    return {
      playerId,
      matches: rows.length,
      roles: [...roleCount].map(([role, matches]) => ({ role, matches })).sort((a, b) => b.matches - a.matches),
      counts: mergeCounts(rows.map((r) => r.counts)),
      time: mergePlayingTime(rows.map((r) => r.time)),
      points: rows.reduce((t, r) => t + r.points, 0),
      errors: rows.reduce((t, r) => t + r.errors, 0),
      stars: rows.reduce((t, r) => t + r.stars, 0),
    };
  });
  players.sort((a, b) => b.points - a.points || b.time.rallies - a.time.rallies);

  const scored = sumSplits(
    list.map((m) => m.scored),
    labels(SPLIT_LABEL as Record<SplitKey, string>),
  );
  return {
    players,
    scored,
    oppErrors: sumSplits(
      list.map((m) => m.oppErrors),
      OPP_ERRORS.map((o) => ({ key: o.key, label: o.label })),
    ),
    given: sumSplits(
      list.map((m) => m.given),
      labels(GIVEN_LABEL),
    ),
    won: list.filter((m) => m.won).length,
  };
}
