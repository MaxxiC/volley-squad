// Fondamentali ed esiti del Live (README → "Esiti per fondamentale"): chi fa punto per ogni esito.

export type Side = "us" | "them";

export const SKILLS = ["serve", "reception", "set", "attack", "block", "fault"] as const;
export type Skill = (typeof SKILLS)[number];

/** Esiti per fondamentale, nell'ordine dei bottoni; `point` = a chi va il punto (null = l'azione continua). */
export const OUTCOMES: Record<Skill, { key: string; label: string; point: Side | null }[]> = {
  serve: [
    { key: "ace", label: "Ace", point: "us" },
    { key: "in", label: "In campo", point: null },
    { key: "error", label: "Errore", point: "them" },
  ],
  reception: [
    { key: "perfect", label: "Perfetta", point: null },
    { key: "good", label: "Buona", point: null },
    { key: "poor", label: "Scarsa", point: null },
    { key: "error", label: "Errore", point: "them" },
  ],
  set: [
    { key: "good", label: "Buona", point: null },
    { key: "poor", label: "Scarsa", point: null },
    { key: "error", label: "Errore", point: "them" },
  ],
  attack: [
    { key: "kill", label: "Punto", point: "us" },
    { key: "in", label: "In campo", point: null },
    { key: "blocked", label: "Murato", point: "them" },
    { key: "error", label: "Errore", point: "them" },
  ],
  block: [
    { key: "point", label: "Punto", point: "us" },
    { key: "touch", label: "Tocco", point: null },
    { key: "net", label: "Invasione", point: "them" },
  ],
  fault: [
    { key: "invasion", label: "Invasione", point: "them" },
    { key: "double", label: "Doppia", point: "them" },
    { key: "position", label: "Posizione", point: "them" },
    { key: "other", label: "Altro", point: "them" },
  ],
};

export const SKILL_LABEL: Record<Skill, string> = {
  serve: "Battuta",
  reception: "Ricezione",
  set: "Alzata",
  attack: "Attacco",
  block: "Muro",
  fault: "Fallo",
};

export function outcomeOf(skill: Skill, key: string) {
  return OUTCOMES[skill].find((o) => o.key === key) ?? null;
}

/** Errore avversario: su una nostra palla semplice (free) o durante una loro azione (rally). */
export const BALL_TYPE_LABEL = { free: "palla semplice nostra", rally: "azione loro" } as const;
export type BallType = keyof typeof BALL_TYPE_LABEL;

/**
 * Modalità semplice: come è arrivato il punto. Ogni tipo diventa un fondamentale+esito
 * (o un evento dell'avversario) e dice se serve scegliere il giocatore.
 */
export type SimpleType =
  | { kind: "skill"; label: string; skill: Skill; outcome: string; includeLibero?: boolean }
  | { kind: "opp_error"; label: string }
  | { kind: "opp_point"; label: string };

export const SIMPLE_OUR_TYPES: SimpleType[] = [
  { kind: "skill", label: "Ace", skill: "serve", outcome: "ace" },
  { kind: "skill", label: "Attacco", skill: "attack", outcome: "kill" },
  { kind: "skill", label: "Muro", skill: "block", outcome: "point" },
  { kind: "opp_error", label: "Errore avversario" },
];

export const SIMPLE_THEIR_TYPES: SimpleType[] = [
  { kind: "opp_point", label: "Punto avversario" },
  { kind: "skill", label: "Errore battuta", skill: "serve", outcome: "error" },
  { kind: "skill", label: "Errore attacco", skill: "attack", outcome: "error" },
  { kind: "skill", label: "Ricezione errata", skill: "reception", outcome: "error", includeLibero: true },
  { kind: "skill", label: "Fallo / invasione", skill: "fault", outcome: "invasion" },
];
