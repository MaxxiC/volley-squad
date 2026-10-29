// Stato del Live ricostruito SEMPRE dal registro eventi: nessun punteggio salvato a parte,
// così annullare/ripristinare o sincronizzare in ritardo non può lasciare uno stato incoerente.
import type { PlayerRole } from "../players";
import type { Side } from "./skills";
import type { LiveEvent, LiveLineup } from "./types";

export type Score = { us: number; them: number };

/** Cambi consentiti per set (oltre si avvisa, senza bloccare). */
export const MAX_SUBS = 6;
/** Timeout per squadra per set. */
export const MAX_TIMEOUTS = 2;
/** Set da vincere per chiudere la partita. */
export const SETS_TO_WIN = 3;

export type LiveState = {
  setN: number;
  score: Score;
  /** Set vinti (chiusi con un evento set_end). */
  sets: Score;
  /** Parziali dei set già chiusi, in ordine. */
  finishedSets: { n: number; us: number; them: number }[];
  serving: Side;
  /** Chi ha battuto per primo in questo set (al set dopo batte per primo l'altro). */
  serveFirst: Side;
  /** P1..P6: id giocatore in campo (il libero compare qui quando è in campo). */
  rotation: number[];
  /** Libero designato per il set. */
  liberoId: number | null;
  /** Giocatore sostituito dal libero; null = libero in panchina. */
  liberoFor: number | null;
  /** Centrale per cui il libero è stato fatto uscire a mano: non rientra da solo finché è in seconda linea. */
  liberoSkip: number | null;
  /** Cambi del set in corso. */
  subs: number;
  /** Coppie del set: chi è uscito → chi è entrato al suo posto (regola del rientro). */
  subPairs: Record<number, number>;
  /** Ruolo con cui un giocatore è entrato nei cambi (vale per il resto della partita). */
  roles: Record<number, PlayerRole>;
  timeouts: Score;
  /** Eventi validi del set in corso, in ordine, con il punteggio subito dopo ciascuno. */
  timeline: { event: LiveEvent; score: Score }[];
  /** Chi ha raggiunto il punteggio per chiudere il set (25, 15 al 5°, con 2 di scarto). */
  setWinner: Side | null;
  /** Qualcuno ha vinto 3 set. */
  matchOver: boolean;
  /** Il set in corso non ha ancora azioni: si può ancora impostare la formazione. */
  setNotStarted: boolean;
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

/** Ultimo timeout valido di una squadra nel set (per il −1: si annulla quello). */
export function lastTimeout(events: Iterable<LiveEvent>, setN: number, side: Side) {
  return activeEvents(events).findLast((e) => e.kind === "timeout" && e.setN === setN && e.detail?.side === side) ?? null;
}

/** Posizioni di seconda linea: P1, P6, P5 (dove può stare il libero). */
export const BACK_ROW = [0, 5, 4] as const;
const FRONT_P4 = 3;

const replace = (pos: number[], out: number, inn: number) => pos.map((id) => (id === out ? inn : id));

/**
 * Il libero non può stare in prima linea: quando la rotazione lo porta in P4 esce da solo e
 * rientra il giocatore che aveva sostituito.
 */
function liberoLeavesFrontRow(s: LiveState): LiveState {
  if (s.liberoId === null || s.liberoFor === null || s.rotation.indexOf(s.liberoId) !== FRONT_P4) return s;
  return { ...s, rotation: replace(s.rotation, s.liberoId, s.liberoFor), liberoFor: null };
}

/**
 * Il libero entra da solo per il centrale in seconda linea (P5, P6; P1 solo se non battiamo noi):
 * così si alterna sui due centrali. Non entra per chi è stato fatto uscire a mano finché è dietro.
 */
function liberoEntersForCentre(s: LiveState, isCentre: (id: number) => boolean): LiveState {
  const skip = s.liberoSkip !== null && (BACK_ROW as readonly number[]).includes(s.rotation.indexOf(s.liberoSkip)) ? s.liberoSkip : null;
  if (skip !== s.liberoSkip) s = { ...s, liberoSkip: skip };
  if (s.liberoId === null || s.liberoFor !== null || s.rotation.includes(s.liberoId)) return s;
  const order = s.serving === "us" ? [4, 5] : [4, 5, 0];
  const index = order.find((i) => s.rotation[i] !== skip && isCentre(s.rotation[i]));
  if (index === undefined) return s;
  const out = s.rotation[index];
  return { ...s, rotation: replace(s.rotation, out, s.liberoId), liberoFor: out };
}

/**
 * @param baseRole ruolo dei presenti in questa partita: se c'è, il libero entra ed esce da solo sui
 *   centrali. Senza (es. sul server per i parziali) il libero si muove solo con gli eventi.
 */
export function computeLive(
  lineups: LiveLineup[],
  events: Iterable<LiveEvent>,
  baseRole?: (id: number) => PlayerRole | undefined,
): LiveState | null {
  const first = lineups.find((l) => l.setN === 1);
  if (!first) return null;

  const auto = (s: LiveState) =>
    baseRole ? liberoEntersForCentre(s, (id) => (s.roles[id] ?? baseRole(id)) === "C") : s;

  /** Nuovo set: formazione del set (se c'è) o stessa rotazione, batte per primo chi prima riceveva. */
  const startSet = (setN: number, previous?: LiveState): LiveState => {
    const lineup = lineups.find((l) => l.setN === setN);
    const serveFirst: Side = lineup?.serveFirst ?? (previous?.serveFirst === "us" ? "them" : "us");
    // Il libero torna in panchina a fine set: in campo il giocatore che sostituiva.
    const carried = previous?.liberoFor && previous.liberoId
      ? replace(previous.rotation, previous.liberoId, previous.liberoFor)
      : previous?.rotation;
    return {
      setN,
      score: { us: 0, them: 0 },
      sets: previous?.sets ?? { us: 0, them: 0 },
      finishedSets: previous?.finishedSets ?? [],
      serving: serveFirst,
      serveFirst,
      rotation: lineup ? [...lineup.slots] : [...(carried ?? first.slots)],
      liberoId: lineup ? lineup.liberoId : (previous?.liberoId ?? null),
      liberoFor: null,
      liberoSkip: null,
      subs: 0,
      subPairs: {},
      roles: previous?.roles ?? {},
      timeouts: { us: 0, them: 0 },
      timeline: [],
      setWinner: null,
      matchOver: false,
      setNotStarted: true,
    };
  };

  let s = auto(startSet(1));
  for (const e of activeEvents(events)) {
    const d = e.detail ?? {};
    switch (e.kind) {
      case "set_end": {
        const winner = setWinnerOf(s.setN, s.score) ?? (s.score.us > s.score.them ? "us" : "them");
        s = auto(
          startSet(s.setN + 1, {
            ...s,
            sets: { ...s.sets, [winner]: s.sets[winner] + 1 },
            finishedSets: [...s.finishedSets, { n: s.setN, ...s.score }],
          }),
        );
        continue;
      }
      case "lineup":
        // Formazione del set: vale solo se il set non è ancora iniziato.
        if (s.setNotStarted && d.slots?.length === 6) {
          s = {
            ...s,
            rotation: [...d.slots],
            liberoId: d.liberoId ?? null,
            liberoFor: null,
            liberoSkip: null,
            serving: d.serveFirst ?? s.serving,
            serveFirst: d.serveFirst ?? s.serveFirst,
          };
        }
        break;
      case "rotation":
        s = liberoLeavesFrontRow({ ...s, rotation: d.dir === -1 ? rotateBack(s.rotation) : rotateClockwise(s.rotation) });
        break;
      case "sub":
        if (d.in && d.out) {
          s = {
            ...s,
            rotation: replace(s.rotation, d.out, d.in),
            subs: s.subs + 1,
            subPairs: { ...s.subPairs, [d.out]: d.in },
            roles: d.role ? { ...s.roles, [d.in]: d.role } : s.roles,
          };
        }
        break;
      case "libero": {
        // Nessuna voce conta come cambio. { in } = libero scelto (posto vuoto); { in, out: libero } =
        // cambio di libero (A ↔ B) o uscita (se rientra chi aveva sostituito); { in: libero, out } = entrata.
        const { in: inn, out } = d;
        if (!inn) break;
        const liberoOnCourt = s.liberoId !== null && s.rotation.includes(s.liberoId);
        if (out === undefined || (out === s.liberoId && !liberoOnCourt)) {
          s = { ...s, liberoId: inn };
        } else if (out === s.liberoId && inn !== s.liberoFor) {
          // Cambio di libero in campo: il nuovo prende il posto del vecchio, per lo stesso giocatore.
          s = { ...s, rotation: replace(s.rotation, out, inn), liberoId: inn };
        } else if (inn === s.liberoId && s.rotation.includes(out)) {
          s = { ...s, rotation: replace(s.rotation, out, inn), liberoFor: out, liberoSkip: null };
        } else if (out === s.liberoId) {
          // Uscita a mano: per chi rientra il libero non torna da solo finché resta in seconda linea.
          s = { ...s, rotation: replace(s.rotation, out, inn), liberoFor: null, liberoSkip: inn };
        }
        break;
      }
      case "swap":
        // Correzione della formazione a set in corso: due giocatori in campo si scambiano di posto.
        // Non conta come cambio e non tocca punteggio né battuta.
        if (d.in && d.out && d.in !== d.out && s.rotation.includes(d.in) && s.rotation.includes(d.out)) {
          const a = s.rotation.indexOf(d.in);
          const b = s.rotation.indexOf(d.out);
          const rotation = [...s.rotation];
          [rotation[a], rotation[b]] = [rotation[b], rotation[a]];
          s = liberoLeavesFrontRow({ ...s, rotation });
        }
        break;
      case "timeout":
        if (d.side) s = { ...s, timeouts: { ...s.timeouts, [d.side]: s.timeouts[d.side] + 1 } };
        break;
      case "correction":
        if (e.point && d.delta) s = { ...s, score: { ...s.score, [e.point]: Math.max(0, s.score[e.point] + d.delta) } };
        break;
      case "action":
        if (e.point) {
          const score = { ...s.score, [e.point]: s.score[e.point] + 1 };
          // Cambio palla a nostro favore: si ruota prima di andare in battuta.
          const rotation = e.point === "us" && s.serving === "them" ? rotateClockwise(s.rotation) : s.rotation;
          s = liberoLeavesFrontRow({ ...s, score, rotation, serving: e.point });
        }
        break;
    }
    s = auto(s);
    if (e.kind !== "lineup") s = { ...s, setNotStarted: false };
    s = { ...s, timeline: [...s.timeline, { event: e, score: s.score }] };
  }
  return {
    ...s,
    setWinner: setWinnerOf(s.setN, s.score),
    matchOver: s.sets.us === SETS_TO_WIN || s.sets.them === SETS_TO_WIN,
  };
}

/**
 * Chi far uscire per il libero (scorciatoia): il centrale in seconda linea, prima P5 e P6, poi P1
 * solo se non stiamo per battere (il libero non batte per primo nel suo turno). null = nessuno adatto.
 */
export function liberoTarget(s: LiveState, roleOf: (id: number) => PlayerRole): number | null {
  if (s.liberoId === null || s.liberoFor !== null) return null;
  const order = s.serving === "us" ? [4, 5] : [4, 5, 0];
  const index = order.find((i) => s.rotation[i] !== s.liberoId && roleOf(s.rotation[i]) === "C");
  return index === undefined ? null : s.rotation[index];
}

/** Rotazione senza il libero (al suo posto chi sostituisce): base per la formazione del set dopo. */
export function rotationWithoutLibero(s: LiveState) {
  return s.liberoId !== null && s.liberoFor !== null ? replace(s.rotation, s.liberoId, s.liberoFor) : s.rotation;
}

/**
 * Regola del rientro: chi è uscito può rientrare una sola volta e solo al posto di chi l'ha
 * sostituito; chi è entrato può uscire solo per far rientrare il titolare. null = cambio regolare.
 */
export function subWarning(s: LiveState, out: number, inn: number): string | null {
  const replacedBy = s.subPairs[inn];
  const outCameInFor = Object.entries(s.subPairs).find(([, entered]) => entered === out)?.[0];
  if (s.subs >= MAX_SUBS) return `Cambi finiti: già ${s.subs}/${MAX_SUBS} in questo set`;
  if (replacedBy !== undefined && replacedBy !== out) return "Rientro non regolare: può rientrare solo al posto di chi l'ha sostituito";
  if (outCameInFor !== undefined && Number(outCameInFor) !== inn) return "Chi è entrato può uscire solo per far rientrare il titolare";
  return null;
}
