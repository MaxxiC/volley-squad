// Formazione in campo: posizioni, riempimento automatico e controlli (usata da Prepara Live e dal Live).
import type { PlayerGender, PlayerRole } from "./players";

/** Indici 0..5 = posizioni P1..P6; valore = id giocatore o null se vuota. */
export type Slots = (number | null)[];

export const EMPTY_SLOTS: Slots = [null, null, null, null, null, null];

/** Ordine di disegno del campo con la rete in alto: P4 P3 P2 / P5 P6 P1. */
export const COURT_ORDER = [3, 2, 1, 4, 5, 0] as const;

/** "Riempi in ordine": ruoli proposti da P1 a P6 (README → Scorciatoie admin). */
export const FILL_ROLE_ORDER: PlayerRole[] = ["P", "S", "C", "O", "S", "C"];

/** Minimo di donne in campo nel campionato misto (solo avviso). */
export const MIN_WOMEN = 2;

type Candidate = { id: number; role: PlayerRole };

/**
 * Riempie le posizioni vuote seguendo FILL_ROLE_ORDER (se manca il ruolo giusto, il primo libero
 * disponibile che non sia un libero) e assegna il libero se manca. Non tocca le posizioni già piene.
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
  next.forEach((id, i) => {
    if (id !== null) return;
    const chosen = pick((c) => c.role === FILL_ROLE_ORDER[i]) ?? pick((c) => c.role !== "L");
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
