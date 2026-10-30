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

/**
 * Errore avversario, versione vecchia: su una nostra palla semplice (free) o durante una loro azione
 * (rally). Resta solo per leggere le partite registrate prima del tipo di errore (OPP_ERRORS).
 */
export const BALL_TYPE_LABEL = { free: "palla semplice nostra", rally: "azione loro" } as const;
export type BallType = keyof typeof BALL_TYPE_LABEL;

/** Errore avversario: che cosa hanno sbagliato (nell'ordine dei bottoni). */
export const OPP_ERRORS = [
  { key: "serve", label: "Battuta sbagliata" },
  { key: "attack_out", label: "Attacco fuori" },
  { key: "attack_net", label: "Attacco in rete" },
  { key: "net", label: "Invasione / rete" },
  { key: "double", label: "Doppia / accompagnata" },
  { key: "position", label: "Fallo di posizione" },
  { key: "other", label: "Altro" },
] as const;
export type OppError = (typeof OPP_ERRORS)[number]["key"];
export const OPP_ERROR_KEYS = OPP_ERRORS.map((o) => o.key) as [OppError, ...OppError[]];

export function oppErrorLabel(key: OppError) {
  return OPP_ERRORS.find((o) => o.key === key)?.label ?? "Altro";
}

/**
 * Fondamentali che il libero può fare: non mura. Nel nostro campionato batte (non per primo nel suo
 * turno: lo gestisce la rotazione, decisioni del 27/10/2026); può fare punto o sbagliare mandando di
 * là una palla (attacco, ma solo come palla semplice), ricevere, alzare, fare falli.
 */
export function liberoCan(skill: Skill) {
  return skill !== "block";
}

/** Fondamentale ed esito che non hanno un giocatore: il fallo di posizione è di tutta la squadra. */
export function isTeamFault(skill: string | null, outcome: string | null) {
  return skill === "fault" && outcome === "position";
}

/**
 * Modalità semplice: come è arrivato il punto. Ogni tipo diventa un fondamentale+esito
 * (o un evento dell'avversario); il giocatore si sceglie sempre, tranne per i falli di squadra.
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
  { kind: "skill", label: "Attacco fuori / rete", skill: "attack", outcome: "error" },
  { kind: "skill", label: "Murato", skill: "attack", outcome: "blocked" },
  { kind: "skill", label: "Ricezione errata", skill: "reception", outcome: "error", includeLibero: true },
  { kind: "skill", label: "Errore alzata", skill: "set", outcome: "error", includeLibero: true },
  { kind: "skill", label: "Invasione a muro / rete", skill: "block", outcome: "net" },
  { kind: "skill", label: "Doppia / accompagnata", skill: "fault", outcome: "double", includeLibero: true },
  { kind: "skill", label: "Fallo di posizione", skill: "fault", outcome: "position" },
];

/**
 * Modalità semplice: azioni senza punto (la palla resta in gioco), per avere statistiche vere
 * anche qui, es. quanti attacchi in tutto per i punti fatti.
 */
export const SIMPLE_RALLY_TYPES: Extract<SimpleType, { kind: "skill" }>[] = [
  { kind: "skill", label: "Ricezione buona", skill: "reception", outcome: "good", includeLibero: true },
  { kind: "skill", label: "Ricezione scarsa", skill: "reception", outcome: "poor", includeLibero: true },
  { kind: "skill", label: "Attacco giocato", skill: "attack", outcome: "in" },
];
