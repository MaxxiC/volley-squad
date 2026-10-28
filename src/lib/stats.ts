// Statistiche dei giocatori dalle azioni del Live (README → "Efficienza (Giocatori)"). Logica pura:
// conteggi per fondamentale ed esito, efficienza in %, fondamentali da mostrare per ruolo.
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
const DETAIL: Record<StatSkill, [key: string, label: string][]> = {
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

/** Colore dell'efficienza: ≥50% oro, <30% rosso, altrimenti normale. */
export function efficiencyTone(eff: number | null): "gold" | "red" | "ink" {
  if (eff === null) return "ink";
  return eff >= 50 ? "gold" : eff < 30 ? "red" : "ink";
}

export type SkillLine = { skill: StatSkill; label: string; eff: number | null; total: number; detail: string };

/**
 * Card da mostrare: i fondamentali dei ruoli giocati, più quelli fuori ruolo con almeno un'azione,
 * nell'ordine fisso.
 */
export function skillLines(c: Counts, roles: PlayerRole[]): SkillLine[] {
  const ofRoles = new Set(roles.flatMap((r) => ROLE_SKILLS[r]));
  return STAT_SKILLS.flatMap((skill) => {
    const total = Object.values(c[skill]).reduce((a, b) => a + b, 0);
    if (!ofRoles.has(skill) && total === 0) return [];
    const detail = DETAIL[skill].map(([k, label]) => `${label} ${c[skill][k] ?? 0}`).join(" · ");
    return [{ skill, label: STAT_LABEL[skill], eff: efficiency(skill, c), total, detail }];
  });
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
