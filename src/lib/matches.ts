import type { MatchSet, MatchWithDetails, Team } from "./types";

/** Set vinti da noi e da loro. */
export function matchScore(sets: MatchSet[]) {
  let us = 0;
  let them = 0;
  for (const s of sets) {
    if (s.us > s.them) us++;
    else them++;
  }
  return { us, them, won: us > them };
}

/** Prima partita non ancora conclusa (le partite sono già in ordine cronologico). */
export function findNextMatch(matches: MatchWithDetails[]) {
  return matches.find((m) => m.status !== "finished") ?? null;
}

export function findLastResult(matches: MatchWithDetails[]) {
  return matches.findLast((m) => m.status === "finished") ?? null;
}

/** Squadre nell'ordine casa → ospite. */
export function matchSides(match: MatchWithDetails, us: Team): [Team, Team] {
  return match.home ? [us, match.opponent] : [match.opponent, us];
}
