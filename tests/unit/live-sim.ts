// Simulatore di partite per i test "a caso" del Live (live-fuzz.test.ts): gioca una partita come
// farebbe il telefono (punti di ogni tipo, azioni senza punto, cambi, libero, scambi, rotazioni,
// timeout, correzioni, Annulla/Ripeti, chiusura dei set e formazione dei set dopo) e alla fine,
// a volte, elimina qualche voce come lo Storico. Tutto deterministico dal seme.
import { EMPTY_HISTORY, record, redo, undo, type History } from "@/lib/live/history";
import { OPP_ERRORS, isTeamFault, liberoCan, type Side, type Skill } from "@/lib/live/skills";
import { BACK_ROW, computeLive, lastTimeout, rotationWithoutLibero, type LiveState } from "@/lib/live/state";
import { isDeletable } from "@/lib/live/storico";
import type { LiveEvent, LiveLineup } from "@/lib/live/types";
import type { PlayerRole } from "@/lib/players";

/** Numeri casuali ripetibili (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]): T => list[int(list.length)],
    /** Sceglie una voce in proporzione al suo peso. */
    weighted: <K extends string>(weights: Record<K, number>): K => {
      const entries = Object.entries(weights) as [K, number][];
      let x = next() * entries.reduce((t, [, w]) => t + w, 0);
      for (const [k, w] of entries) if ((x -= w) < 0) return k;
      return entries[entries.length - 1][0];
    },
  };
}
export type Rand = ReturnType<typeof rng>;

/** Rosa finta: titolari 1–6 (alzatore, banda, centrale, opposto, banda, centrale), panchina, due liberi. */
export const ROLES: Record<number, PlayerRole> = {
  1: "P", 2: "S", 3: "C", 4: "O", 5: "S", 6: "C",
  7: "S", 8: "C", 9: "O", 10: "P", 13: "S", 14: "C",
  11: "L", 12: "L",
};
export const LIBEROS = [11, 12];
const PLAYERS = Object.keys(ROLES).map(Number);
const FIELD_ROLES: PlayerRole[] = ["P", "S", "O", "C"];

export const baseRole = (id: number) => ROLES[id];

export type SimResult = {
  lineups: LiveLineup[];
  /** Ultima versione di ogni evento (anche annullati), come nel registro. */
  events: Map<string, LiveEvent>;
  history: History;
  /** La partita ha avuto eliminazioni "da Storico" in mezzo al registro. */
  storicoEdits: number;
};

export type SimOptions = {
  maxSteps?: number;
  /** false = niente eliminazioni da Storico alla fine. */
  storico?: boolean;
  /** Chiamata con lo stato prima di ogni passo della parte "Live" (per i controlli sul campo). */
  onState?: (s: LiveState) => void;
};

export function simulate(r: Rand, opts: SimOptions = {}): SimResult {
  const maxSteps = opts.maxSteps ?? 260;
  const start = r.int(6);
  const lineups: LiveLineup[] = [
    {
      setN: 1,
      // Formazione standard girata a caso (alzatore in una posizione qualsiasi).
      slots: [1, 2, 3, 4, 5, 6].map((_, i, a) => a[(i + start) % 6]),
      liberoId: r.chance(0.85) ? r.pick(LIBEROS) : null,
      serveFirst: r.pick(["us", "them"] as const),
    },
  ];
  const events = new Map<string, LiveEvent>();
  let history: History = EMPTY_HISTORY;
  let seq = 0;
  let ids = 0;

  const state = () => {
    const s = computeLive(lineups, events.values(), baseRole);
    if (!s) throw new Error("computeLive senza stato");
    return s;
  };
  const uuid = () => {
    const hex = (++ids).toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  };
  const add = (fields: Partial<LiveEvent> & Pick<LiveEvent, "kind">) => {
    const e: LiveEvent = {
      id: uuid(),
      setN: state().setN,
      seq: ++seq,
      createdAt: new Date(Date.UTC(2026, 10, 9, 19, 0, seq)).toISOString(),
      playerId: null,
      skill: null,
      outcome: null,
      point: null,
      star: false,
      incomplete: false,
      deleted: false,
      detail: null,
      ...fields,
    };
    events.set(e.id, e);
    history = record(history, { before: null, after: e });
    return e;
  };
  const update = (id: string, patch: Partial<LiveEvent>) => {
    const before = events.get(id);
    if (!before) return;
    const after = { ...before, ...patch };
    events.set(id, after);
    history = record(history, { before, after });
  };
  const active = () => [...events.values()].filter((e) => !e.deleted).sort((a, b) => a.seq - b.seq);

  /** Un giocatore in campo che può fare quel fondamentale (il libero non mura). */
  const doer = (s: LiveState, skill: Skill) => {
    const ok = s.rotation.filter((id) => id !== s.liberoId || liberoCan(skill));
    return ok.length ? r.pick(ok) : s.rotation[0];
  };

  const point = (s: LiveState) => {
    const side: Side = r.pick(["us", "them"]);
    // A volte il punto si segna "da completare" e si completa subito o mai.
    if (r.chance(0.12)) {
      const e = add({ kind: "action", point: side, incomplete: true });
      if (r.chance(0.6)) {
        if (side === "us") update(e.id, { skill: "attack", outcome: "kill", playerId: doer(s, "attack"), incomplete: false });
        else update(e.id, { skill: "opp_point", incomplete: false });
      }
      return;
    }
    if (side === "us") {
      const kind = r.weighted({ ace: 2, kill: 5, block: 2, opp: 4 });
      if (kind === "opp") return void add({ kind: "action", point: "us", skill: "opp_error", detail: { oppError: r.pick(OPP_ERRORS).key } });
      const [skill, outcome] = ({ ace: ["serve", "ace"], kill: ["attack", "kill"], block: ["block", "point"] } as const)[kind];
      const playerId = skill === "serve" ? s.rotation[0] : doer(s, skill);
      return void add({ kind: "action", point: "us", skill, outcome, playerId, star: r.chance(0.1) });
    }
    const kind = r.weighted({ opp: 5, serve: 2, attack: 2, blocked: 1, reception: 2, set: 1, net: 1, double: 1, position: 1 });
    if (kind === "opp") return void add({ kind: "action", point: "them", skill: "opp_point" });
    const [skill, outcome] = (
      {
        serve: ["serve", "error"],
        attack: ["attack", "error"],
        blocked: ["attack", "blocked"],
        reception: ["reception", "error"],
        set: ["set", "error"],
        net: ["block", "net"],
        double: ["fault", "double"],
        position: ["fault", "position"],
      } as const
    )[kind];
    const playerId = isTeamFault(skill, outcome) ? null : skill === "serve" ? s.rotation[0] : doer(s, skill);
    add({ kind: "action", point: "them", skill, outcome, playerId });
  };

  const rally = (s: LiveState) => {
    const [skill, outcome] = r.pick([
      ["reception", "good"],
      ["reception", "poor"],
      ["reception", "perfect"],
      ["attack", "in"],
      ["set", "good"],
      ["set", "poor"],
      ["block", "touch"],
      ["serve", "in"],
    ] as const);
    add({ kind: "action", skill, outcome, playerId: skill === "serve" ? s.rotation[0] : doer(s, skill) });
  };

  const sub = (s: LiveState) => {
    if (s.subs >= 6) return;
    const outs = s.rotation.filter((id) => id !== s.liberoId);
    const bench = PLAYERS.filter((id) => !s.rotation.includes(id) && !LIBEROS.includes(id) && id !== s.liberoFor);
    if (!outs.length || !bench.length) return;
    add({ kind: "sub", detail: { out: r.pick(outs), in: r.pick(bench), role: r.pick(FIELD_ROLES) } });
  };

  const libero = (s: LiveState) => {
    if (s.liberoId === null) return void add({ kind: "libero", detail: { in: r.pick(LIBEROS) } });
    const onCourt = s.rotation.includes(s.liberoId);
    const other = LIBEROS.find((id) => id !== s.liberoId)!;
    if (!onCourt) {
      // Entra per un giocatore di seconda linea (come il bottone del campo).
      const back = BACK_ROW.map((i) => s.rotation[i]).filter((id) => id !== s.liberoId);
      if (r.chance(0.8) && back.length) add({ kind: "libero", detail: { in: s.liberoId, out: r.pick(back) } });
      else add({ kind: "libero", detail: { in: other, out: s.liberoId } });
      return;
    }
    if (r.chance(0.6) && s.liberoFor !== null) add({ kind: "libero", detail: { in: s.liberoFor, out: s.liberoId } });
    else add({ kind: "libero", detail: { in: other, out: s.liberoId } });
  };

  const swap = (s: LiveState) => {
    const field = s.rotation.filter((id) => id !== s.liberoId);
    if (field.length < 2) return;
    const a = r.pick(field);
    const b = r.pick(field.filter((id) => id !== a));
    add({ kind: "swap", detail: { in: a, out: b } });
  };

  /** Formazione del set dopo: la rotazione di fine set, a volte con un cambio dalla panchina. */
  const nextLineup = (s: LiveState) => {
    const slots = [...rotationWithoutLibero(s)];
    if (r.chance(0.4)) {
      const bench = PLAYERS.filter((id) => !slots.includes(id) && !LIBEROS.includes(id));
      slots[r.int(6)] = r.pick(bench);
    }
    add({ kind: "lineup", detail: { slots, liberoId: r.chance(0.9) ? r.pick(LIBEROS) : null, serveFirst: r.pick(["us", "them"] as const) } });
  };

  for (let step = 0; step < maxSteps; step++) {
    const s = state();
    opts.onState?.(s);
    if (s.matchOver) {
      // A partita finita a volte si annulla l'ultima chiusura e si va avanti.
      if (r.chance(0.3)) {
        const res = undo(history);
        if (res) {
          history = res.history;
          events.set(res.apply.id, res.apply);
          continue;
        }
      }
      break;
    }
    const needLineup = s.setN > 1 && s.setNotStarted && !s.timeline.some((t) => t.event.kind === "lineup");
    if (needLineup && r.chance(0.9)) {
      nextLineup(s);
      continue;
    }
    if (s.setWinner && r.chance(0.85)) {
      add({ kind: "set_end" });
      continue;
    }
    const what = r.weighted({ point: 58, rally: 12, sub: 4, libero: 5, swap: 2, rotation: 2, timeout: 3, untimeout: 1, correction: 3, undo: 6, redo: 2, complete: 2 });
    switch (what) {
      case "point":
        point(s);
        break;
      case "rally":
        rally(s);
        break;
      case "sub":
        sub(s);
        break;
      case "libero":
        libero(s);
        break;
      case "swap":
        swap(s);
        break;
      case "rotation":
        add({ kind: "rotation", detail: { dir: 1 } });
        break;
      case "timeout":
        add({ kind: "timeout", detail: { side: r.pick(["us", "them"] as const) } });
        break;
      case "untimeout": {
        const last = lastTimeout(events.values(), s.setN, r.pick(["us", "them"] as const));
        if (last) update(last.id, { deleted: true });
        break;
      }
      case "correction":
        add({ kind: "correction", point: r.pick(["us", "them"] as const), detail: { delta: r.chance(0.7) ? 1 : -1 } });
        break;
      case "undo": {
        const res = undo(history);
        if (res) {
          history = res.history;
          events.set(res.apply.id, res.apply);
        }
        break;
      }
      case "redo": {
        const res = redo(history);
        if (res) {
          history = res.history;
          events.set(res.apply.id, res.apply);
        }
        break;
      }
      case "complete": {
        const open = active().filter((e) => e.incomplete);
        if (open.length) {
          const e = r.pick(open);
          if (e.point === "us") update(e.id, { skill: "serve", outcome: "ace", playerId: s.rotation[0], incomplete: false });
          else update(e.id, { skill: "opp_point", incomplete: false });
        }
        break;
      }
    }
  }

  // Storico: a volte si eliminano voci in mezzo al registro (azioni, timeout, correzioni, scambi).
  let storicoEdits = 0;
  if (opts.storico !== false && r.chance(0.35)) {
    for (let k = r.int(4) + 1; k > 0; k--) {
      const list = active().filter(isDeletable);
      if (!list.length) break;
      update(r.pick(list).id, { deleted: true });
      storicoEdits++;
    }
  }

  return { lineups, events, history, storicoEdits };
}
