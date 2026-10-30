// Statistiche dei giocatori dalle azioni del Live (README → "Efficienza (Giocatori)"). Logica pura:
// conteggi per fondamentale ed esito, efficienza in %, fondamentali da mostrare per ruolo.
import { OPP_ERRORS, type OppError } from "./live/skills";
import type { Rally } from "./live/state";
import type { LiveEvent } from "./live/types";
import type { PlayerRole } from "./players";

/** Fondamentali con un'efficienza (il fallo conta solo come errore, non ha una sua %). */
export type StatSkill = "attack" | "reception" | "serve" | "block" | "set";

/** Ordine delle card. */
export const STAT_SKILLS: StatSkill[] = ["attack", "reception", "serve", "block", "set"];

export const STAT_LABEL: Record<StatSkill, string> = {
  attack: "Attacco",
  reception: "Ricezione",
  serve: "Battuta",
  block: "Muro",
  set: "Alzata",
};

/** Fondamentali di ogni ruolo (README → Scheda giocatore). */
export const ROLE_SKILLS: Record<PlayerRole, StatSkill[]> = {
  P: ["set", "serve", "block"],
  S: ["attack", "reception", "serve", "block"],
  O: ["attack", "serve", "block"],
  C: ["attack", "block", "serve"],
  L: ["reception"],
};

/** Esiti contati per fondamentale, con l'etichetta del dettaglio. */
export const SKILL_OUTCOMES: Record<StatSkill, [key: string, label: string][]> = {
  attack: [["kill", "Punti"], ["in", "In campo"], ["blocked", "Murati"], ["error", "Errori"]],
  reception: [["perfect", "Perfette"], ["good", "Buone"], ["poor", "Scarse"], ["error", "Errori"]],
  serve: [["ace", "Ace"], ["in", "In campo"], ["error", "Errori"]],
  block: [["point", "Punti"], ["touch", "Tocchi"], ["net", "Invasioni"]],
  set: [["good", "Buone"], ["poor", "Scarse"], ["error", "Errori"]],
};

export type Counts = Record<StatSkill, Record<string, number>>;

export function emptyCounts(): Counts {
  return { attack: {}, reception: {}, serve: {}, block: {}, set: {} };
}

const isStatSkill = (s: string | null): s is StatSkill => s !== null && (STAT_SKILLS as string[]).includes(s);

/** Somma di più conteggi (es. tutte le partite, o solo quelle in un ruolo). */
export function mergeCounts(list: Counts[]): Counts {
  const out = emptyCounts();
  for (const c of list) {
    for (const skill of STAT_SKILLS) {
      for (const [k, n] of Object.entries(c[skill])) out[skill][k] = (out[skill][k] ?? 0) + n;
    }
  }
  return out;
}

/** Conteggi per giocatore delle azioni valide di una partita (annullate e senza giocatore escluse). */
export function countsByPlayer(events: Iterable<Pick<LiveEvent, "deleted" | "kind" | "playerId" | "skill" | "outcome">>): Map<number, Counts> {
  const out = new Map<number, Counts>();
  for (const e of events) {
    if (e.deleted || e.kind !== "action" || !e.playerId || !isStatSkill(e.skill) || !e.outcome) continue;
    const c = out.get(e.playerId) ?? emptyCounts();
    c[e.skill][e.outcome] = (c[e.skill][e.outcome] ?? 0) + 1;
    out.set(e.playerId, c);
  }
  return out;
}

/** Efficienza in % intera; null se non ci sono azioni. */
export function efficiency(skill: StatSkill, c: Counts): number | null {
  const n = (k: string) => c[skill][k] ?? 0;
  const total = Object.values(c[skill]).reduce((a, b) => a + b, 0);
  let value: number;
  switch (skill) {
    case "serve":
      value = (n("ace") - n("error")) / total;
      break;
    case "reception":
      value = (n("perfect") + n("good") * 0.5 - n("error")) / total;
      break;
    case "attack":
      value = (n("kill") - n("error") - n("blocked")) / total;
      break;
    case "block":
      // Punti / (punti + tocchi + invasioni): sono tutti gli esiti del muro.
      value = n("point") / total;
      break;
    case "set":
      value = n("good") / total;
      break;
  }
  return total ? Math.round(value * 100) : null;
}

/** "35%", "−33%" (segno meno tipografico), "—" se non c'è. */
export function formatPct(eff: number | null) {
  if (eff === null) return "—";
  return eff < 0 ? `−${-eff}%` : `${eff}%`;
}

/** Colore dell'efficienza: ≥50% oro, <30% rosso, altrimenti normale. */
export function efficiencyTone(eff: number | null): "gold" | "red" | "ink" {
  if (eff === null) return "ink";
  return eff >= 50 ? "gold" : eff < 30 ? "red" : "ink";
}

/** Azioni di un fondamentale. */
export function skillTotal(c: Counts, skill: StatSkill) {
  return Object.values(c[skill]).reduce((a, b) => a + b, 0);
}

/**
 * Card della scheda giocatore: i fondamentali dei ruoli giocati in evidenza (anche senza azioni),
 * poi quelli fuori ruolo con almeno un'azione; sempre nell'ordine fisso.
 */
export function skillGroups(c: Counts, roles: PlayerRole[]) {
  const focus = STAT_SKILLS.filter((s) => roles.some((r) => ROLE_SKILLS[r].includes(s)));
  const others = STAT_SKILLS.filter((s) => !focus.includes(s) && skillTotal(c, s) > 0);
  return { focus, others };
}

/**
 * Ruolo di ciascun giocatore in una partita: quello dei presenti (Prepara Live), oppure, se è
 * entrato con un cambio, il ruolo indicato nel cambio (l'ultimo).
 */
export function matchRoles(
  present: { playerId: number; role: PlayerRole }[],
  events: Iterable<Pick<LiveEvent, "deleted" | "kind" | "seq" | "detail">>,
) {
  const roles = new Map(present.map((p) => [p.playerId, p.role]));
  const subs = [...events].filter((e) => e.kind === "sub" && !e.deleted && e.detail?.in && e.detail.role).sort((a, b) => a.seq - b.seq);
  for (const e of subs) roles.set(e.detail!.in!, e.detail!.role!);
  return roles;
}

/** Partite mostrate nel grafico Andamento. */
export const TREND_MATCHES = 12;

/**
 * Finestre di `size` partite consecutive con la media più alta e più bassa (bande del grafico
 * Andamento). null se le partite non bastano a distinguerle o se le medie sono tutte uguali.
 */
export function bestWorstWindows(values: number[], size = 3) {
  if (values.length <= size) return null;
  let best = { start: 0, avg: -Infinity };
  let worst = { start: 0, avg: Infinity };
  for (let i = 0; i + size <= values.length; i++) {
    const avg = values.slice(i, i + size).reduce((a, b) => a + b, 0) / size;
    if (avg > best.avg) best = { start: i, avg };
    if (avg < worst.avg) worst = { start: i, avg };
  }
  if (best.avg === worst.avg) return null;
  return { best: { ...best, avg: Math.round(best.avg) }, worst: { ...worst, avg: Math.round(worst.avg) }, size };
}

// --- Tempo in campo, punti ed errori (pagina Statistiche) ---------------------------------------

export type PlayingTime = {
  /** Punti giocati: scambi in cui era in campo. */
  rallies: number;
  /** Set in cui ha giocato almeno un punto. */
  sets: number;
  /** Di questi, set giocati dal primo all'ultimo punto. */
  fullSets: number;
};

/** Tempo in campo di ciascun giocatore dai punti della partita (`LiveState.rallies`). */
export function playingTime(rallies: Rally[]): Map<number, PlayingTime> {
  const perSet = new Map<number, number>();
  const mine = new Map<number, Map<number, number>>();
  for (const r of rallies) {
    perSet.set(r.setN, (perSet.get(r.setN) ?? 0) + 1);
    for (const id of r.onCourt) {
      const sets = mine.get(id) ?? new Map<number, number>();
      sets.set(r.setN, (sets.get(r.setN) ?? 0) + 1);
      mine.set(id, sets);
    }
  }
  const out = new Map<number, PlayingTime>();
  for (const [id, sets] of mine) {
    let rallyCount = 0;
    let fullSets = 0;
    for (const [setN, n] of sets) {
      rallyCount += n;
      if (n === perSet.get(setN)) fullSets++;
    }
    out.set(id, { rallies: rallyCount, sets: sets.size, fullSets });
  }
  return out;
}

/** Somma i tempi in campo di più partite. */
export function mergePlayingTime(list: PlayingTime[]): PlayingTime {
  return list.reduce((a, b) => ({ rallies: a.rallies + b.rallies, sets: a.sets + b.sets, fullSets: a.fullSets + b.fullSets }), {
    rallies: 0,
    sets: 0,
    fullSets: 0,
  });
}

type ScoredEvent = Pick<LiveEvent, "deleted" | "kind" | "playerId" | "point">;

/** Punti fatti (ace, attacco, muro) ed errori che hanno dato il punto all'avversario, per giocatore. */
export function pointsAndErrors(events: Iterable<ScoredEvent>): Map<number, { points: number; errors: number }> {
  const out = new Map<number, { points: number; errors: number }>();
  for (const e of events) {
    if (e.deleted || e.kind !== "action" || !e.playerId || !e.point) continue;
    const row = out.get(e.playerId) ?? { points: 0, errors: 0 };
    if (e.point === "us") row.points++;
    else row.errors++;
    out.set(e.playerId, row);
  }
  return out;
}

export type GivenKey = "serve" | "reception" | "attack" | "blocked" | "set" | "block" | "fault" | "opp_point" | "other";

/** Come l'avversario ha fatto punto: loro punti o nostri errori, per fondamentale. */
export const GIVEN_LABEL: Record<GivenKey, string> = {
  opp_point: "Punti loro",
  serve: "Errori in battuta",
  reception: "Errori in ricezione",
  attack: "Attacchi fuori / in rete",
  blocked: "Attacchi murati",
  set: "Errori in alzata",
  block: "Invasioni a muro",
  fault: "Falli",
  other: "Altro",
};

type GivenEvent = Pick<LiveEvent, "deleted" | "kind" | "skill" | "outcome" | "point">;

/** Punti dell'avversario per tipo; "Altro" (es. punti mai completati) e le voci a zero si tolgono. */
export function pointsGiven(events: Iterable<GivenEvent>) {
  const n = Object.fromEntries(Object.keys(GIVEN_LABEL).map((k) => [k, 0])) as Record<GivenKey, number>;
  for (const e of events) {
    if (e.deleted || e.kind !== "action" || e.point !== "them") continue;
    const key: GivenKey =
      e.skill === "opp_point"
        ? "opp_point"
        : e.skill === "attack"
          ? e.outcome === "blocked"
            ? "blocked"
            : "attack"
          : e.skill && e.skill in GIVEN_LABEL
            ? (e.skill as GivenKey)
            : "other";
    n[key]++;
  }
  return (Object.keys(GIVEN_LABEL) as GivenKey[]).filter((k) => n[k] > 0).map((key) => ({ key, label: GIVEN_LABEL[key], value: n[key] }));
}

type OppErrorEvent = Pick<LiveEvent, "deleted" | "kind" | "skill" | "point" | "detail">;

/** Errori dell'avversario per tipo (quelli registrati senza tipo vanno in "Altro"); le voci a zero si tolgono. */
export function oppErrorSplit(events: Iterable<OppErrorEvent>) {
  const n = new Map<OppError, number>();
  for (const e of events) {
    if (e.deleted || e.kind !== "action" || e.skill !== "opp_error") continue;
    const key = e.detail?.oppError ?? "other";
    n.set(key, (n.get(key) ?? 0) + 1);
  }
  return OPP_ERRORS.filter((o) => n.get(o.key)).map((o) => ({ key: o.key, label: o.label, value: n.get(o.key) ?? 0 }));
}
