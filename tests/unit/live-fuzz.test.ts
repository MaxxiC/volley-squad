// Test "a caso" del Live: partite simulate (live-sim.ts) e regole che devono valere sempre, su
// stato, Annulla/Ripeti, unione con il telefono, Storico, testi del feed, validazione e statistiche.
// Quante partite: FUZZ_RUNS (npm test ne fa poche, npm run test:fuzz migliaia); FUZZ_SEED per
// ripetere esattamente un caso che fallisce (il seme è scritto nel messaggio d'errore).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { describeEvent } from "@/lib/live/describe";
import { LiveEventSchema } from "@/lib/live/event-schema";
import { historyFromLog, restoreHistory, undo, redo } from "@/lib/live/history";
import { mergeLogs } from "@/lib/live/merge";
import { outcomeOf, type Side } from "@/lib/live/skills";
import { activeEvents, computeLive, setWinnerOf, type LiveState } from "@/lib/live/state";
import { EDIT_SKILLS, applyEdit, defaultOutcome, editIssue, pointOf, setRows } from "@/lib/live/storico";
import type { LiveEvent } from "@/lib/live/types";
import { countsByPlayer, playingTime, pointsAndErrors } from "@/lib/stats";
import { matchStat } from "@/lib/stats-season";
import { LIBEROS, ROLES, baseRole, rng, simulate, type SimResult } from "./live-sim";

const RUNS = Number(process.env.FUZZ_RUNS ?? 30);
const FIRST_SEED = Number(process.env.FUZZ_SEED ?? 1);
const FRONT_ROW = [1, 2, 3];

/** Partite simulate una volta sola e riusate da tutte le regole. */
const sims = new Map<number, SimResult>();
const simOf = (seed: number) => sims.get(seed) ?? sims.set(seed, simulate(rng(seed))).get(seed)!;

/** Esegue `check` su RUNS partite; in caso di errore dice il seme per ripeterla. */
function forEachMatch(name: string, check: (sim: SimResult, seed: number) => void) {
  test(`${name} (${RUNS} partite)`, () => {
    for (let seed = FIRST_SEED; seed < FIRST_SEED + RUNS; seed++) {
      const sim = simOf(seed);
      try {
        check(sim, seed);
      } catch (err) {
        // Messaggio breve con il seme: il confronto completo dei registri sarebbe illeggibile.
        const msg = err instanceof Error ? err.message.split("\n").slice(0, 12).join("\n") : String(err);
        throw new Error(`FUZZ_SEED=${seed} → ${msg}`);
      }
    }
  });
}

const live = (sim: SimResult, events: Iterable<LiveEvent> = sim.events.values(), roles = true) => {
  const s = computeLive(sim.lineups, events, roles ? baseRole : undefined);
  assert.ok(s, "computeLive senza stato");
  return s;
};

/** Regole sul campo valide dopo ogni azione fatta dal telefono. */
function checkCourt(s: LiveState) {
  assert.equal(s.rotation.length, 6, "sempre 6 in campo");
  assert.equal(new Set(s.rotation).size, 6, `nessun giocatore due volte: ${s.rotation}`);
  for (const id of s.rotation) assert.ok(ROLES[id], `in campo un giocatore che non esiste: ${id}`);
  const liberoOn = s.liberoId !== null && s.rotation.includes(s.liberoId);
  assert.equal(liberoOn, s.liberoFor !== null, "libero in campo ⇔ c'è chi sostituisce");
  if (s.liberoFor !== null) assert.ok(!s.rotation.includes(s.liberoFor), "chi è sostituito dal libero non è in campo");
  if (liberoOn) assert.ok(!FRONT_ROW.includes(s.rotation.indexOf(s.liberoId!)), `libero in prima linea: ${s.rotation}`);
  for (const id of s.rotation) if (LIBEROS.includes(id)) assert.equal(id, s.liberoId, "in campo solo il libero del set");
  assert.ok(s.score.us >= 0 && s.score.them >= 0, "punteggio mai negativo");
  assert.ok(s.subs >= 0 && s.subs <= 6, `cambi tra 0 e 6: ${s.subs}`);
}

/** Punteggio, set e parziali ricalcolati da zero, senza passare da computeLive. */
function expectedScore(events: Iterable<LiveEvent>) {
  let score = { us: 0, them: 0 };
  const finished: { us: number; them: number }[] = [];
  let lastPoint: Side | null = null;
  for (const e of activeEvents(events)) {
    if (e.kind === "set_end") {
      finished.push(score);
      score = { us: 0, them: 0 };
      lastPoint = null;
    } else if (e.kind === "action" && e.point) {
      score = { ...score, [e.point]: score[e.point] + 1 };
      lastPoint = e.point;
    } else if (e.kind === "correction" && e.point && e.detail?.delta) {
      score = { ...score, [e.point]: Math.max(0, score[e.point] + e.detail.delta) };
    }
  }
  return { score, finished, lastPoint };
}

const sameState = (a: LiveState, b: LiveState) => JSON.stringify(a) === JSON.stringify(b);

describe("Live: partite a caso", () => {
  test(`campo sempre valido dopo ogni azione: 6 diversi, libero solo dietro e coerente (${RUNS} partite)`, () => {
    for (let seed = FIRST_SEED; seed < FIRST_SEED + RUNS; seed++) {
      try {
        simulate(rng(seed), { storico: false, onState: checkCourt });
      } catch (err) {
        throw new Error(`FUZZ_SEED=${seed} → ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  forEachMatch("anche col registro corretto dallo Storico il campo è valido dopo ogni evento", (sim) => {
    if (!sim.storicoEdits) return;
    const act = activeEvents(sim.events.values());
    for (let i = 0; i <= act.length; i++) checkCourt(live(sim, act.slice(0, i)));
  });

  forEachMatch("punteggio, set e parziali = conteggio indipendente di punti e correzioni", (sim) => {
    const s = live(sim);
    const exp = expectedScore(sim.events.values());
    assert.deepEqual(s.score, exp.score);
    assert.deepEqual(s.finishedSets.map(({ us, them }) => ({ us, them })), exp.finished);
    assert.deepEqual(s.finishedSets.map((f) => f.n), exp.finished.map((_, i) => i + 1));
    assert.equal(s.setN, exp.finished.length + 1);
    // Chi ha vinto ogni set chiuso (vince chi è avanti) e i set vinti.
    const won = { us: 0, them: 0 };
    for (const f of s.finishedSets) won[setWinnerOf(f.n, f) ?? (f.us > f.them ? "us" : "them")]++;
    assert.deepEqual(s.sets, won);
    assert.equal(s.matchOver, s.sets.us === 3 || s.sets.them === 3);
    // Batte chi ha fatto l'ultimo punto del set (se c'è).
    if (exp.lastPoint) assert.equal(s.serving, exp.lastPoint);
  });

  forEachMatch("punti giocati: uno per ogni punto con un'azione, 6 in campo, somma = 6 × punti", (sim) => {
    const s = live(sim);
    const points = activeEvents(sim.events.values()).filter((e) => e.kind === "action" && e.point);
    assert.equal(s.rallies.length, points.length);
    for (const r of s.rallies) assert.equal(new Set(r.onCourt).size, 6);
    const time = playingTime(s.rallies);
    assert.equal([...time.values()].reduce((t, p) => t + p.rallies, 0), 6 * points.length);
    for (const p of time.values()) assert.ok(p.fullSets <= p.sets && p.rallies >= p.sets);
  });

  forEachMatch("il libero automatico non cambia mai punteggio, set e battuta", (sim) => {
    const withRoles = live(sim);
    const without = live(sim, sim.events.values(), false);
    for (const k of ["score", "sets", "finishedSets", "serving", "setN", "matchOver", "timeouts", "subs"] as const) {
      assert.deepEqual(without[k], withRoles[k], k);
    }
    assert.equal(without.rallies.length, withRoles.rallies.length);
  });

  forEachMatch("l'ordine di arrivo degli eventi e gli annullati non contano (conta la seq)", (sim, seed) => {
    const all = [...sim.events.values()];
    const r = rng(seed * 7919);
    const shuffled = [...all].sort(() => r.next() - 0.5);
    assert.ok(sameState(live(sim, shuffled), live(sim, all)), "ordine diverso");
    assert.ok(sameState(live(sim, all.filter((e) => !e.deleted)), live(sim, all)), "senza gli annullati");
  });

  forEachMatch("la timeline del set in corso ha il punteggio giusto dopo ogni evento", (sim) => {
    const s = live(sim);
    const last = s.timeline.at(-1);
    if (last) assert.deepEqual(last.score, s.score);
    for (const t of s.timeline) assert.equal(t.event.setN, s.setN, "timeline solo del set in corso");
  });
});

describe("Annulla / Ripeti a caso", () => {
  forEachMatch("annullare tutto toglie ogni azione; ripetere altrettanto torna identico", (sim) => {
    const events = new Map(sim.events);
    let h = sim.history;
    let undone = 0;
    for (let res = undo(h); res; res = undo(h), undone++) {
      h = res.history;
      events.set(res.apply.id, res.apply);
    }
    assert.equal(activeEvents(events.values()).length, 0, "dopo Annulla su tutto non resta nulla");
    // Si ripete solo ciò che si è annullato qui (la partita può finire con azioni già in "Ripeti").
    for (let k = 0; k < undone; k++) {
      const res = redo(h);
      assert.ok(res, "Ripeti disponibile");
      h = res.history;
      events.set(res.apply.id, res.apply);
    }
    assert.deepEqual(events, sim.events);
  });

  forEachMatch("pila salvata ripresa identica; senza pila Annulla toglie l'ultima azione valida", (sim) => {
    if (sim.history.done.length) assert.equal(restoreHistory(sim.history, sim.events), sim.history);
    const rebuilt = restoreHistory(null, sim.events);
    const act = activeEvents(sim.events.values());
    const res = undo(rebuilt);
    if (!act.length) return assert.equal(res, null);
    assert.ok(res);
    assert.equal(res.apply.id, act.at(-1)!.id);
    assert.equal(res.apply.deleted, true);
    assert.deepEqual(historyFromLog(sim.events.values()).done.length, act.length);
  });
});

describe("Telefono e server a caso", () => {
  forEachMatch("unione registro del server + copia locale: nessun evento perso, vince la versione da inviare", (sim, seed) => {
    const r = rng(seed * 104729);
    const all = [...sim.events.values()];
    // Il server conosce solo una parte (pagina vecchia in cache), il telefono tutto.
    const server = all.filter(() => r.chance(0.6)).map((e) => (r.chance(0.2) ? { ...e, star: !e.star } : e));
    const local = all.map((event) => ({ event, pending: r.chance(0.3) }));
    const { events, toSend } = mergeLogs(server, local);
    assert.equal(events.size, all.length);
    for (const { event, pending } of local) {
      if (pending) assert.equal(events.get(event.id), event);
    }
    assert.equal(toSend.length, local.filter((l) => l.pending).length);
    for (const e of server) if (!local.find((l) => l.event.id === e.id)?.pending) assert.equal(events.get(e.id), e);
  });

  forEachMatch("ogni evento passa la validazione dell'API e ha un testo leggibile nel feed", (sim) => {
    const playerOf = (id: number) => (ROLES[id] ? { id, number: id, firstName: `G${id}`, lastName: "", role: ROLES[id], gender: null } : undefined);
    for (const e of sim.events.values()) {
      const parsed = LiveEventSchema.safeParse(e);
      assert.ok(parsed.success, `evento rifiutato: ${JSON.stringify(e)} ${parsed.error?.message ?? ""}`);
      const text = describeEvent(e, playerOf, "Avversari");
      assert.ok(text.length > 0 && !/undefined|NaN|null|\?$/.test(text), `testo strano: "${text}"`);
    }
  });
});

describe("Storico a caso", () => {
  forEachMatch("righe di ogni set chiuso: l'ultima ha il punteggio di fine set", (sim) => {
    const s = live(sim, sim.events.values(), false);
    const all = [...sim.events.values()];
    for (const f of s.finishedSets) {
      const rows = setRows(sim.lineups, all, f.n);
      const last = rows.at(-1);
      assert.deepEqual(last ? last.score : { us: 0, them: 0 }, { us: f.us, them: f.them }, `set ${f.n}`);
    }
  });

  forEachMatch("modifica di un'azione a caso: stesso evento, punto ricavato dall'esito, punteggio coerente", (sim, seed) => {
    const r = rng(seed * 31337);
    const actions = activeEvents(sim.events.values()).filter((e) => e.kind === "action");
    for (let k = 0; k < 5 && actions.length; k++) {
      const e = r.pick(actions);
      const skill = r.pick(EDIT_SKILLS);
      const edit = { skill, outcome: defaultOutcome(skill, e.point), playerId: r.pick(Object.keys(ROLES).map(Number)), star: r.chance(0.2) };
      assert.equal(editIssue(edit), null);
      const next = applyEdit(e, edit);
      assert.equal(next.id, e.id);
      assert.equal(next.seq, e.seq);
      assert.equal(next.point, pointOf(edit, e.point));
      if (next.skill && next.skill !== "opp_error" && next.skill !== "opp_point" && next.outcome) {
        assert.equal(outcomeOf(next.skill, next.outcome)?.point ?? null, next.point);
      }
      const events = new Map(sim.events).set(e.id, next);
      const exp = expectedScore(events.values());
      assert.deepEqual(live(sim, events.values(), false).score, exp.score);
    }
  });
});

describe("Statistiche a caso", () => {
  forEachMatch("conteggi, punti ed errori dei giocatori tornano con le azioni", (sim) => {
    const act = activeEvents(sim.events.values());
    const counts = countsByPlayer(act);
    const counted = [...counts.values()].reduce((t, c) => t + Object.values(c).reduce((a, o) => a + Object.values(o).reduce((x, y) => x + y, 0), 0), 0);
    const withPlayer = act.filter((e) => e.kind === "action" && e.playerId && e.outcome && e.skill !== "fault" && e.skill !== "opp_error" && e.skill !== "opp_point");
    assert.equal(counted, withPlayer.length);
    const pe = pointsAndErrors(act);
    const ours = act.filter((e) => e.kind === "action" && e.point === "us" && e.playerId).length;
    const theirs = act.filter((e) => e.kind === "action" && e.point === "them" && e.playerId).length;
    assert.equal([...pe.values()].reduce((t, p) => t + p.points, 0), ours);
    assert.equal([...pe.values()].reduce((t, p) => t + p.errors, 0), theirs);
  });

  forEachMatch("numeri di squadra della partita = punti registrati; tempo in campo come nel Live", (sim) => {
    const act = activeEvents(sim.events.values());
    // Presenti: tutta la rosa col suo ruolo, come in Prepara Live (serve al libero automatico).
    const present = Object.keys(ROLES).map((id) => ({ playerId: Number(id), role: ROLES[Number(id)] }));
    const m = matchStat({ id: 1, label: "A1", title: "Andata 1ª", result: "", won: false, friendly: false, total: { us: 0, them: 0 }, mvpId: null }, sim.lineups, act, present);
    const sum = (list: { value: number }[]) => list.reduce((t, s) => t + s.value, 0);
    assert.equal(sum(m.scored), act.filter((e) => e.kind === "action" && e.point === "us").length);
    assert.equal(sum(m.given), act.filter((e) => e.kind === "action" && e.point === "them").length);
    assert.equal(sum(m.oppErrors), act.filter((e) => e.kind === "action" && e.skill === "opp_error").length);
    const time = playingTime(live(sim, act).rallies);
    for (const [id, p] of Object.entries(m.players)) assert.deepEqual(p.time, time.get(Number(id)) ?? { rallies: 0, sets: 0, fullSets: 0 });
  });
});
