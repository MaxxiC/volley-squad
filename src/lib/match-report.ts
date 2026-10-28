// Riepilogo pubblico di fine partita (README → Riepilogo partita pubblico): come abbiamo fatto
// punto, i migliori, squadra a confronto, riga dell'MVP. Tutto ricavato dalle azioni del Live.
// Dell'avversario si sa solo "punto avversario" ed "errore avversario": il confronto usa solo quello.
import { activeEvents } from "./live/state";
import type { LiveEvent } from "./live/types";
import { countsByPlayer, efficiency, type Counts } from "./stats";

type Event = Pick<LiveEvent, "seq" | "kind" | "playerId" | "skill" | "outcome" | "point" | "star" | "deleted">;

export type SplitKey = "attack" | "block" | "ace" | "opp_error" | "other";

export const SPLIT_LABEL: Record<SplitKey, string> = {
  attack: "Attacco",
  block: "Muro",
  ace: "Ace",
  opp_error: "Errori avversari",
  other: "Altro",
};

/** Tipo di un nostro punto (null = non è un nostro punto). */
function splitOf(e: Event): SplitKey | null {
  if (e.kind !== "action" || e.point !== "us") return null;
  if (e.skill === "attack" && e.outcome === "kill") return "attack";
  if (e.skill === "block" && e.outcome === "point") return "block";
  if (e.skill === "serve" && e.outcome === "ace") return "ace";
  if (e.skill === "opp_error") return "opp_error";
  return "other";
}

/** Come abbiamo fatto punto: conteggi per tipo, "Altro" (es. punti mai completati) solo se c'è. */
export function pointSplit(events: Iterable<Event>) {
  const n: Record<SplitKey, number> = { attack: 0, block: 0, ace: 0, opp_error: 0, other: 0 };
  for (const e of activeEvents(events as Iterable<LiveEvent>)) {
    const key = splitOf(e);
    if (key) n[key]++;
  }
  return (Object.keys(n) as SplitKey[]).filter((k) => k !== "other" || n.other > 0).map((key) => ({ key, label: SPLIT_LABEL[key], value: n[key] }));
}

export type Best = { category: string; playerId: number; value: string };

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

/** Il migliore secondo `score` (il più alto; a parità il primo per `tie`); null se nessuno ha valore > 0. */
function bestBy(counts: Map<number, Counts>, score: (c: Counts) => number, tie: (c: Counts) => number) {
  let best: { id: number; c: Counts } | null = null;
  for (const [id, c] of counts) {
    if (score(c) <= 0) continue;
    if (!best || score(c) > score(best.c) || (score(c) === score(best.c) && tie(c) > tie(best.c))) best = { id, c };
  }
  return best;
}

/** Ricezioni minime per contare nella "miglior ricezione" (con 1 ricezione perfetta non si è i migliori). */
export const MIN_RECEPTIONS = 3;

/** I migliori: attacco (punti), muro (punti), battuta (ace), ricezione (% positiva). */
export function bestPlayers(events: Iterable<Event>): Best[] {
  const counts = countsByPlayer(activeEvents(events as Iterable<LiveEvent>));
  const n = (c: Counts, skill: keyof Counts, k: string) => c[skill][k] ?? 0;
  const positive = (c: Counts) => (sum(c.reception) >= MIN_RECEPTIONS ? (n(c, "reception", "perfect") + n(c, "reception", "good")) / sum(c.reception) : 0);
  const out: Best[] = [];

  const attack = bestBy(counts, (c) => n(c, "attack", "kill"), (c) => efficiency("attack", c) ?? -Infinity);
  if (attack) {
    const kills = n(attack.c, "attack", "kill");
    out.push({ category: "Attacco", playerId: attack.id, value: `${kills} ${kills === 1 ? "punto" : "punti"} · ${efficiency("attack", attack.c)}%` });
  }
  const block = bestBy(counts, (c) => n(c, "block", "point"), (c) => -sum(c.block));
  if (block) {
    const p = n(block.c, "block", "point");
    out.push({ category: "Muro", playerId: block.id, value: `${p} ${p === 1 ? "punto" : "punti"}` });
  }
  const serve = bestBy(counts, (c) => n(c, "serve", "ace"), (c) => -n(c, "serve", "error"));
  if (serve) {
    const errors = n(serve.c, "serve", "error");
    out.push({ category: "Battuta", playerId: serve.id, value: `${n(serve.c, "serve", "ace")} ace · ${errors} ${errors === 1 ? "errore" : "errori"}` });
  }
  const reception = bestBy(counts, positive, (c) => sum(c.reception));
  if (reception) out.push({ category: "Ricezione", playerId: reception.id, value: `${Math.round(positive(reception.c) * 100)}% positiva` });
  return out;
}

/** Nostri errori che danno il punto all'avversario (README → Esiti per fondamentale). */
const OUR_ERRORS = new Set(["serve", "reception", "set", "attack", "block", "fault"]);

/**
 * Squadra a confronto: [noi, loro] per riga. Punti conquistati = attacco, muro e ace nostri contro i
 * "punto avversario"; errori = punti regalati; serie = punti di fila più lunga dentro un set.
 */
export function comparison(events: Iterable<Event>, sets: { us: number; them: number }[]) {
  const list = activeEvents(events as Iterable<LiveEvent>);
  const won = { us: 0, them: 0 };
  const errors = { us: 0, them: 0 };
  const streak = { us: 0, them: 0 };
  let run = null as { side: "us" | "them"; n: number } | null;
  for (const e of list) {
    if (e.kind === "set_end") run = null;
    if (e.kind !== "action" || !e.point) continue;
    const key = splitOf(e);
    if (key === "attack" || key === "block" || key === "ace") won.us++;
    if (e.point === "them" && e.skill === "opp_point") won.them++;
    if (e.point === "us" && e.skill === "opp_error") errors.them++;
    if (e.point === "them" && e.skill && OUR_ERRORS.has(e.skill)) errors.us++;
    run = run?.side === e.point ? { side: e.point, n: run.n + 1 } : { side: e.point, n: 1 };
    streak[e.point] = Math.max(streak[e.point], run.n);
  }
  const total = sets.reduce((t, s) => ({ us: t.us + s.us, them: t.them + s.them }), { us: 0, them: 0 });
  return [
    { label: "Punti totali", us: total.us, them: total.them },
    { label: "Punti conquistati", us: won.us, them: won.them },
    { label: "Errori (punti regalati)", us: errors.us, them: errors.them },
    { label: "Serie più lunga", us: streak.us, them: streak.them },
  ];
}

/** Riga dell'MVP: punti fatti (attacco, muro, ace), efficienza in attacco, stelline. */
export function playerLine(events: Iterable<Event>, playerId: number) {
  const list = activeEvents(events as Iterable<LiveEvent>);
  const c = countsByPlayer(list).get(playerId);
  const points = list.filter((e) => e.playerId === playerId && ["attack", "block", "ace"].includes(splitOf(e) ?? "")).length;
  const stars = list.filter((e) => e.playerId === playerId && e.star).length;
  return { points, attack: c ? efficiency("attack", c) : null, stars };
}
