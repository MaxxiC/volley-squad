// Formazione in campo: posizioni, riempimento automatico e controlli (usata da Prepara Live e dal Live).
import type { PlayerGender, PlayerRole } from "./players";

/** Indici 0..5 = posizioni P1..P6; valore = id giocatore o null se vuota. */
export type Slots = (number | null)[];

export const EMPTY_SLOTS: Slots = [null, null, null, null, null, null];

/** Ordine di disegno del campo con la rete in alto: P4 P3 P2 / P5 P6 P1. */
export const COURT_ORDER = [3, 2, 1, 4, 5, 0] as const;

/** "Riempi in ordine": ruoli proposti da P1 a P6 (README → Scorciatoie admin). */
export const FILL_ROLE_ORDER: PlayerRole[] = ["P", "S", "C", "O", "S", "C"];

/**
 * Ruolo che ogni posto ha nello schema normale (P S C O S C a partire dall'alzatore), per chi in
 * formazione sta al posto di un altro ruolo (es. un centrale al posto della banda): id → ruolo del posto.
 * Vuoto se la formazione non è completa o non c'è un solo alzatore.
 */
export function roleMismatches(slots: Slots, roleOf: (id: number) => PlayerRole | undefined) {
  const result = new Map<number, PlayerRole>();
  if (slots.some((x) => x === null)) return result;
  const setters = slots.flatMap((id, i) => (roleOf(id as number) === "P" ? [i] : []));
  if (setters.length !== 1) return result;
  slots.forEach((id, i) => {
    const expected = FILL_ROLE_ORDER[(i - setters[0] + 6) % 6];
    const role = roleOf(id as number);
    if (role && role !== "L" && role !== expected) result.set(id as number, expected);
  });
  return result;
}

/**
 * Ruoli consigliati per ogni posizione, ricavati da chi è già in campo: lo schema P S C O S C
 * si fa girare finché segue il più possibile i ruoli già messi (il libero non conta). Con più
 * giri ugualmente buoni si uniscono i ruoli (es. solo una banda in P2: in P1 alzatore o opposto,
 * che stanno sempre uno di fronte all'altro). Campo vuoto: lo schema con l'alzatore in P1.
 */
export function suggestedRoles(slots: Slots, roleOf: (id: number) => PlayerRole | undefined): PlayerRole[][] {
  const score = (k: number) =>
    slots.reduce<number>((n, id, i) => n + (id !== null && roleOf(id) === FILL_ROLE_ORDER[(i - k + 6) % 6] ? 1 : 0), 0);
  const scores = FILL_ROLE_ORDER.map((_, k) => score(k));
  const best = Math.max(...scores);
  const turns = best === 0 ? [0] : scores.flatMap((s, k) => (s === best ? [k] : []));
  return slots.map((_, i) => [...new Set(turns.map((k) => FILL_ROLE_ORDER[(i - k + 6) % 6]))]);
}

/** Ordine dei gruppi di ruolo nella lista dei presenti. */
const ROLE_GROUP_ORDER: PlayerRole[] = ["P", "S", "O", "C", "L"];

/**
 * Presenti divisi per ruolo: prima i ruoli consigliati (nell'ordine dato), poi gli altri.
 * Dentro un gruppo resta l'ordine di partenza.
 */
export function groupByRole<P extends { id: number }>(
  players: P[],
  roleOf: (id: number) => PlayerRole | undefined,
  preferred: PlayerRole[] = [],
) {
  const order = [...new Set([...preferred, ...ROLE_GROUP_ORDER])];
  return order
    .map((role) => ({ role, preferred: preferred.includes(role), players: players.filter((p) => (roleOf(p.id) ?? "S") === role) }))
    .filter((g) => g.players.length > 0);
}

/** Minimo di donne in campo nel campionato misto (solo avviso). */
export const MIN_WOMEN = 2;

type Candidate = { id: number; role: PlayerRole };

/**
 * Riempie le posizioni vuote con i ruoli consigliati (`suggestedRoles`: lo schema gira con chi è già
 * in campo; se manca il ruolo giusto, il primo libero disponibile che non sia un libero) e assegna il
 * libero se manca. Non tocca le posizioni già piene.
 */
export function fillInOrder(slots: Slots, libero: number | null, present: Candidate[]) {
  const next = [...slots];
  const taken = new Set([...next.filter((x): x is number => x !== null), ...(libero ? [libero] : [])]);
  const pick = (ok: (c: Candidate) => boolean) => present.find((c) => !taken.has(c.id) && ok(c))?.id ?? null;

  let nextLibero = libero;
  if (!nextLibero) {
    nextLibero = pick((c) => c.role === "L");
    if (nextLibero) taken.add(nextLibero);
  }
  // Lo schema gira con chi è già in campo (es. alzatore messo in P3).
  const roles = suggestedRoles(next, (id) => present.find((c) => c.id === id)?.role);
  next.forEach((id, i) => {
    if (id !== null) return;
    const chosen = pick((c) => roles[i].includes(c.role)) ?? pick((c) => c.role !== "L");
    if (chosen !== null) {
      next[i] = chosen;
      taken.add(chosen);
    }
  });
  return { slots: next, libero: nextLibero };
}

/** Donne in campo tra i giocatori indicati; `unknown` = sesso non indicato in anagrafica. */
export function womenOnCourt(ids: number[], genderOf: (id: number) => PlayerGender | null) {
  let women = 0;
  let unknown = 0;
  for (const id of ids) {
    const g = genderOf(id);
    if (g === "F") women++;
    else if (g === null) unknown++;
  }
  return { women, unknown, warn: women < MIN_WOMEN };
}
