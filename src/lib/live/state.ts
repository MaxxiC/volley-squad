// Stato del Live ricostruito SEMPRE dal registro eventi: nessun punteggio salvato a parte,
// così annullare/ripristinare o sincronizzare in ritardo non può lasciare uno stato incoerente.
import type { Side } from "./skills";
import type { LiveEvent, LiveLineup } from "./types";

export type Score = { us: number; them: number };

export type LiveState = {
  setN: number;
  score: Score;
  /** Set vinti (chiusi con un evento set_end). */
  sets: Score;
  serving: Side;
  /** Chi ha battuto per primo in questo set (al set dopo batte per primo l'altro). */
  serveFirst: Side;
  /** P1..P6: id giocatore in campo. */
  rotation: number[];
  liberoId: number | null;
  /** Eventi validi del set in corso, in ordine, con il punteggio subito dopo ciascuno. */
  timeline: { event: LiveEvent; score: Score }[];
  /** Chi ha raggiunto il punteggio per chiudere il set (25, 15 al 5°, con 2 di scarto). */
  setWinner: Side | null;
};

/** Rotazione in senso orario: chi era in P2 va in P1 (README → Rotazione automatica). */
export function rotateClockwise(pos: number[]) {
  return pos.map((_, i) => pos[(i + 1) % 6]);
}

function rotateBack(pos: number[]) {
  return pos.map((_, i) => pos[(i + 5) % 6]);
}

export function setTarget(setN: number) {
  return setN === 5 ? 15 : 25;
}

export function setWinnerOf(setN: number, score: Score): Side | null {
  const target = setTarget(setN);
  if (Math.max(score.us, score.them) < target || Math.abs(score.us - score.them) < 2) return null;
  return score.us > score.them ? "us" : "them";
}

/** Eventi in ordine di registrazione (seq), esclusi gli annullati. */
export function activeEvents(events: Iterable<LiveEvent>) {
  return [...events].filter((e) => !e.deleted).sort((a, b) => a.seq - b.seq);
}

export function computeLive(lineups: LiveLineup[], events: Iterable<LiveEvent>): LiveState | null {
  const lineupOf = (setN: number) => lineups.find((l) => l.setN === setN);
  const first = lineupOf(1);
  if (!first) return null;

  const startSet = (setN: number, previous?: LiveState): LiveState => {
    const lineup = lineupOf(setN);
    // Senza formazione salvata per il set nuovo: stessa rotazione, batte per primo chi prima riceveva.
    const serveFirst: Side = lineup?.serveFirst ?? (previous?.serveFirst === "us" ? "them" : "us");
    return {
      setN,
      score: { us: 0, them: 0 },
      sets: previous?.sets ?? { us: 0, them: 0 },
      serving: serveFirst,
      serveFirst,
      rotation: lineup ? [...lineup.slots] : [...(previous?.rotation ?? first.slots)],
      liberoId: lineup ? lineup.liberoId : (previous?.liberoId ?? null),
      timeline: [],
      setWinner: null,
    };
  };

  let s = startSet(1);
  for (const e of activeEvents(events)) {
    if (e.kind === "set_end") {
      const winner = setWinnerOf(s.setN, s.score) ?? (s.score.us > s.score.them ? "us" : "them");
      const sets = { ...s.sets, [winner]: s.sets[winner] + 1 };
      s = startSet(s.setN + 1, { ...s, sets });
      continue;
    }
    if (e.kind === "rotation") {
      s = { ...s, rotation: e.detail?.dir === -1 ? rotateBack(s.rotation) : rotateClockwise(s.rotation) };
    }
    if (e.point) {
      const score = { ...s.score, [e.point]: s.score[e.point] + 1 };
      // Cambio palla a nostro favore: si ruota prima di andare in battuta.
      const rotation = e.point === "us" && s.serving === "them" ? rotateClockwise(s.rotation) : s.rotation;
      s = { ...s, score, rotation, serving: e.point };
    }
    s = { ...s, timeline: [...s.timeline, { event: e, score: s.score }] };
  }
  return { ...s, setWinner: setWinnerOf(s.setN, s.score) };
}
