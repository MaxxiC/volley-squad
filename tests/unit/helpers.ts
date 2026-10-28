// Costruttori di eventi e formazioni finti per i test della logica del Live.
import type { Side } from "@/lib/live/skills";
import type { LiveEvent, LiveLineup } from "@/lib/live/types";

/** Crea eventi con seq crescente: ogni test ne crea uno suo, così i numeri ripartono. */
export function eventFactory() {
  let seq = 0;
  return (o: Partial<LiveEvent> = {}): LiveEvent => {
    seq++;
    return {
      id: `e${seq}`,
      setN: 1,
      seq,
      createdAt: "2026-10-28T20:00:00.000Z",
      kind: "action",
      playerId: null,
      skill: null,
      outcome: null,
      point: null,
      star: false,
      incomplete: false,
      deleted: false,
      detail: null,
      ...o,
    };
  };
}

/** P1..P6 = giocatori 1..6, libero 9. */
export function lineup(serveFirst: Side, o: Partial<LiveLineup> = {}): LiveLineup[] {
  return [{ setN: 1, slots: [1, 2, 3, 4, 5, 6], liberoId: 9, serveFirst, ...o }];
}

/** n punti consecutivi per una squadra. */
export function points(ev: ReturnType<typeof eventFactory>, side: Side, n: number) {
  return Array.from({ length: n }, () => ev({ point: side }));
}

/** Set vinto 25–0 e chiuso. */
export function wonSet(ev: ReturnType<typeof eventFactory>, side: Side = "us") {
  return [...points(ev, side, 25), ev({ kind: "set_end" })];
}
