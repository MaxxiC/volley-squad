import { TEAM_NAME } from "./club";
import type { MatchWithDetails, Team } from "./types";

/** Set necessari per vincere una partita. */
export const SETS_TO_WIN = 3;

type SetScore = { us: number; them: number };

/** Set vinti da noi e da loro; `over` = qualcuno è arrivato a 3. */
export function matchScore(sets: SetScore[]) {
  const us = sets.filter((s) => s.us > s.them).length;
  const them = sets.length - us;
  return { us, them, won: us > them, over: us === SETS_TO_WIN || them === SETS_TO_WIN };
}

/** Prima partita da giocare o in corso (le partite sono già in ordine cronologico); le rinviate si saltano. */
export function findNextMatch(matches: MatchWithDetails[]) {
  return matches.find((m) => m.status === "scheduled" || m.status === "live") ?? null;
}

export function findLastResult(matches: MatchWithDetails[]) {
  return matches.findLast((m) => m.status === "finished") ?? null;
}

/** Squadre nell'ordine casa → ospite. */
export function matchSides(match: MatchWithDetails, us: Team): [Team, Team] {
  return match.home ? [us, match.opponent] : [match.opponent, us];
}

/** "CUSBros vs Dinamite" oppure "Dinamite vs CUSBros". */
export function matchTitle(home: boolean, opponent: string) {
  return home ? `${TEAM_NAME} vs ${opponent}` : `${opponent} vs ${TEAM_NAME}`;
}

/** Parziali di una partita assegnata a tavolino (3–0 d'ufficio, 25–0 a set). */
export function forfeitSets(won: boolean) {
  return Array.from({ length: SETS_TO_WIN }, () => (won ? { us: 25, them: 0 } : { us: 0, them: 25 }));
}

/** Nome avversario breve per bottoni e tabellone: "Ghedauto Iveco Volley CUSB" → "Ghedauto". */
export function shortTeamName(name: string) {
  if (name.length <= 14) return name;
  const first = name.split(/\s+/)[0];
  return first.length >= 4 ? first : name;
}

export const PHASE_LABEL = { andata: "Andata", ritorno: "Ritorno" } as const;

/** "Andata 2ª", "Ritorno 11ª" */
export function roundLabel(match: { phase: keyof typeof PHASE_LABEL; round: number }) {
  return `${PHASE_LABEL[match.phase]} ${match.round}ª`;
}
