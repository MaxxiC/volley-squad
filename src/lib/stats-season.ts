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
  /** Amichevole: di base fuori dalle statistiche (filtro Ufficiali / Tutte / Amichevoli). */
  friendly: boolean;
  /** Punti veri della partita (somma dei parziali), anche quelli aggiunti con "Correggi". */
  total: { us: number; them: number };
  mvpId: number | null;
  players: Record<number, PlayerMatchStat>;
  /** Come abbiamo fatto punto (con "Corretti a mano" per i punti senza azione). */
  scored: Split[];
  /** Errori dell'avversario per tipo. */
  oppErrors: Split[];
  /** Come l'avversario ha fatto punto (con "Corretti a mano" per i punti senza azione). */
  given: Split[];
};

const NO_TIME: PlayingTime = { rallies: 0, sets: 0, fullSets: 0 };

/** Punti della partita senza un'azione: aggiunti con la correzione del punteggio. */
const MANUAL = { key: "manual", label: "Corretti a mano" };

/** Aggiunge "Corretti a mano" se i punti veri sono più di quelli registrati azione per azione. */
function withManual(list: Split[], real: number): Split[] {
  const missing = real - list.reduce((t, s) => t + s.value, 0);
  return missing > 0 ? [...list, { ...MANUAL, value: missing }] : list;
}

/**
 * Numeri di una partita dal suo registro. `present` = presenti di Prepara Live col ruolo di quel
 * giorno: servono anche al libero automatico, così "chi era in campo" è quello vero.
 */
export function matchStat(
  meta: Pick<MatchStat, "id" | "label" | "title" | "result" | "won" | "friendly" | "total" | "mvpId">,
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
  return {
    ...meta,
    players,
    scored: withManual(pointSplit(events), meta.total.us),
    oppErrors: oppErrorSplit(events),
    given: withManual(pointsGiven(events), meta.total.them),
  };
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

/** Quali partite contano: di base solo le ufficiali, le amichevoli si aggiungono col filtro. */
export const MATCH_KINDS = [
  { key: "ufficiali", label: "Ufficiali" },
  { key: "tutte", label: "Tutte" },
  { key: "amichevoli", label: "Amichevoli" },
] as const;
export type MatchKind = (typeof MATCH_KINDS)[number]["key"];

export function byKind<T extends { friendly: boolean }>(list: T[], kind: MatchKind): T[] {
  return kind === "tutte" ? list : list.filter((m) => m.friendly === (kind === "amichevoli"));
}

/** Totali di un giocatore dalle sue partite. */
export function sumPlayer(playerId: number, rows: PlayerMatchStat[]): PlayerTotals {
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
}

/** Una partita di un giocatore (scheda giocatore): la partita e i suoi numeri. */
export type PlayerMatchRow = Pick<MatchStat, "id" | "label" | "title" | "result" | "won" | "friendly"> & { mvp: boolean; stat: PlayerMatchStat };

/** Le partite in cui il giocatore era tra i presenti (o è entrato con un cambio), in ordine di data. */
export function playerRows(list: MatchStat[], playerId: number): PlayerMatchRow[] {
  return list.flatMap((m) => {
    const stat = m.players[playerId];
    return stat
      ? [{ id: m.id, label: m.label, title: m.title, result: m.result, won: m.won, friendly: m.friendly, mvp: m.mvpId === playerId, stat }]
      : [];
  });
}

/** Somma di più partite: giocatori (in ordine di punti fatti) e squadra. */
export function sumMatches(list: MatchStat[]) {
  const byPlayer = new Map<number, PlayerMatchStat[]>();
  for (const m of list) {
    for (const [id, p] of Object.entries(m.players)) byPlayer.set(Number(id), [...(byPlayer.get(Number(id)) ?? []), p]);
  }
  const players = [...byPlayer].map(([playerId, rows]) => sumPlayer(playerId, rows));
  players.sort((a, b) => b.points - a.points || b.time.rallies - a.time.rallies);

  return {
    players,
    scored: sumSplits(
      list.map((m) => m.scored),
      [...labels(SPLIT_LABEL as Record<SplitKey, string>), MANUAL],
    ),
    oppErrors: sumSplits(
      list.map((m) => m.oppErrors),
      OPP_ERRORS.map((o) => ({ key: o.key, label: o.label })),
    ),
    given: sumSplits(
      list.map((m) => m.given),
      [...labels(GIVEN_LABEL), MANUAL],
    ),
    won: list.filter((m) => m.won).length,
    total: { us: list.reduce((t, m) => t + m.total.us, 0), them: list.reduce((t, m) => t + m.total.them, 0) },
  };
}
