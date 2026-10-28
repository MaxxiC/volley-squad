// Storico live: correzione delle azioni di una partita conclusa. Logica pura (client e server):
// righe di un set con il punteggio ricalcolato, modifica di un'azione (il punto si ricava da
// fondamentale ed esito, README → "Esiti per fondamentale") e posizione di un'azione aggiunta.
import { BALL_TYPE_LABEL, OUTCOMES, SKILLS, SKILL_LABEL, outcomeOf, type BallType, type Side, type Skill } from "./skills";
import { activeEvents, computeLive, setWinnerOf, type LiveState, type Score } from "./state";
import type { LiveEvent, LiveLineup, OppSkill } from "./types";

/** Fondamentali scelti nello Storico: i nostri più l'avversario (errore o punto). */
export const EDIT_SKILLS = [...SKILLS, "opp_error", "opp_point"] as const;
export type EditSkill = Skill | OppSkill;

export const EDIT_SKILL_LABEL: Record<EditSkill, string> = {
  ...SKILL_LABEL,
  opp_error: "Errore avversario",
  opp_point: "Punto avversario",
};

/**
 * Modifica di un'azione. skill null = ancora da completare (resta il punto già segnato).
 * outcome: esito del fondamentale, oppure per l'errore avversario il tipo di palla (free/rally).
 */
export type ActionEdit = { skill: EditSkill | null; outcome: string | null; playerId: number | null; star: boolean };

/** Esiti selezionabili: per l'errore avversario il tipo di palla, per il punto avversario nessuno. */
export function outcomeOptions(skill: EditSkill | null): { key: string; label: string; point: Side | null }[] {
  if (skill === "opp_error") {
    return (Object.keys(BALL_TYPE_LABEL) as BallType[]).map((k) => ({ key: k, label: BALL_TYPE_LABEL[k], point: "us" }));
  }
  if (skill === null || skill === "opp_point") return [];
  return OUTCOMES[skill];
}

/** Esito proposto cambiando fondamentale: se possibile uno con lo stesso punto, così il punteggio non cambia per sbaglio. */
export function defaultOutcome(skill: EditSkill | null, point: Side | null) {
  const options = outcomeOptions(skill);
  return (options.find((o) => o.point === point) ?? options[0])?.key ?? null;
}

/** Chi fa punto con questa modifica (null = l'azione continua). */
export function pointOf(edit: ActionEdit, current: Side | null): Side | null {
  if (edit.skill === null) return current;
  if (edit.skill === "opp_error") return "us";
  if (edit.skill === "opp_point") return "them";
  return outcomeOf(edit.skill, edit.outcome ?? "")?.point ?? null;
}

/** Modifica non coerente (es. esito di un altro fondamentale); null = valida. */
export function editIssue(edit: ActionEdit): string | null {
  const options = outcomeOptions(edit.skill);
  if (options.length && !options.some((o) => o.key === edit.outcome)) return "Esito non valido per questo fondamentale";
  return null;
}

/** Valori del form per un'azione registrata. */
export function editOf(e: LiveEvent): ActionEdit {
  const skill = (e.skill as EditSkill | null) ?? null;
  return { skill, outcome: skill === "opp_error" ? (e.detail?.ballType ?? "free") : e.outcome, playerId: e.playerId, star: e.star };
}

/**
 * Nuova versione dell'azione. Senza giocatore un fondamentale nostro resta "da completare";
 * per l'avversario il giocatore non serve.
 */
export function applyEdit(e: LiveEvent, edit: ActionEdit): LiveEvent {
  const base = { ...e, star: edit.star, point: pointOf(edit, e.point) };
  if (edit.skill === null) return { ...base, skill: null, outcome: null, playerId: edit.playerId, incomplete: true };
  if (edit.skill === "opp_error" || edit.skill === "opp_point") {
    const detail = edit.skill === "opp_error" ? { ballType: (edit.outcome as BallType) ?? "free" } : null;
    return { ...base, skill: edit.skill, outcome: null, playerId: null, detail, incomplete: false };
  }
  return { ...base, skill: edit.skill, outcome: edit.outcome, playerId: edit.playerId, detail: null, incomplete: edit.playerId === null };
}

/** Azioni che si possono modificare (fondamentali, punti) ed eventi che si possono eliminare. */
export const isEditable = (e: LiveEvent) => e.kind === "action";
export const isDeletable = (e: LiveEvent) => e.kind === "action" || e.kind === "timeout" || e.kind === "correction";

/** Set con almeno un evento (in ordine). */
export function setsOf(events: Iterable<LiveEvent>) {
  return [...new Set(activeEvents(events).map((e) => e.setN))].sort((a, b) => a - b);
}

/** Eventi di un set con il punteggio subito dopo ciascuno (esclusi formazione e chiusura del set). */
export function setRows(lineups: LiveLineup[], events: LiveEvent[], setN: number): { event: LiveEvent; score: Score }[] {
  // Il registro fermato prima della chiusura del set: lo stato resta su quel set con la sua timeline.
  const upTo = events.filter((e) => e.setN < setN || (e.setN === setN && e.kind !== "set_end"));
  const live = computeLive(lineups, upTo);
  if (!live || live.setN !== setN) return [];
  return live.timeline.filter((t) => t.event.kind !== "lineup");
}

/**
 * Seq della nuova azione: subito dopo `afterId`, oppure in fondo al set (prima della sua chiusura).
 * Gli eventi con seq uguale o maggiore vanno spostati di 1.
 */
export function insertSeq(events: LiveEvent[], setN: number, afterId: string | null) {
  const all = [...events].sort((a, b) => a.seq - b.seq);
  if (afterId) {
    const after = all.find((e) => e.id === afterId);
    if (after) return after.seq + 1;
  }
  const end = all.find((e) => e.setN === setN && e.kind === "set_end" && !e.deleted);
  if (end) return end.seq;
  return (all.at(-1)?.seq ?? 0) + 1;
}

/**
 * Dopo una correzione: la partita deve risultare ancora finita e ogni set chiuso deve avere un
 * punteggio di fine set (25, 15 al 5°, con 2 di scarto), come nel Live. null = tutto a posto.
 */
export function finishedIssue(live: LiveState | null): string | null {
  if (!live?.matchOver) return "Con questa modifica la partita non risulterebbe più finita: controlla i punti del set";
  const bad = live.finishedSets.find((s) => setWinnerOf(s.n, s) === null);
  return bad ? `Con questa modifica il set ${bad.n} finirebbe ${bad.us}–${bad.them}, che non è un punteggio di fine set (per spostare un punto da una squadra all'altra aggiungi prima l'azione che manca)` : null;
}
