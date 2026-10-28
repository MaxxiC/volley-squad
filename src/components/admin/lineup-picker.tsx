"use client";

// Scelta della formazione (campo P4 P3 P2 / P5 P6 P1 + libero): usata da Prepara Live per il 1° set
// e dal Live per i set successivi. Si tocca una posizione, poi un giocatore; si avanza da soli
// alla prossima posizione vuota.
import { useState } from "react";
import { COURT_ORDER, EMPTY_SLOTS, MIN_WOMEN, womenOnCourt, type Slots } from "@/lib/lineup";
import { ROLE_LABEL, fullName, shortName, type PlayerGender, type PlayerRole } from "@/lib/players";

type PickPlayer = { id: number; number: number; firstName: string; lastName: string; gender: PlayerGender | null };

export function useLineup(initialSlots: Slots = EMPTY_SLOTS, initialLibero: number | null = null) {
  const [slots, setSlots] = useState<Slots>(initialSlots);
  const [libero, setLibero] = useState<number | null>(initialLibero);
  const [target, setTarget] = useState<number | "libero">(() => Math.max(0, initialSlots.findIndex((x) => x === null)));

  /** Mette il giocatore nella posizione selezionata (o come libero) togliendolo da dove era. */
  const place = (id: number) => {
    if (target === "libero") {
      const next = slots.map((x) => (x === id ? null : x));
      setSlots(next);
      setLibero(id);
      setTarget(Math.max(0, next.findIndex((x) => x === null)));
      return;
    }
    const next = slots.map((x) => (x === id ? null : x));
    next[target] = id;
    setSlots(next);
    if (libero === id) setLibero(null);
    const empty = next.findIndex((x) => x === null);
    if (empty >= 0) setTarget(empty);
  };

  const set = (nextSlots: Slots, nextLibero: number | null) => {
    setSlots(nextSlots);
    setLibero(nextLibero);
    setTarget(Math.max(0, nextSlots.findIndex((x) => x === null)));
  };

  return { slots, libero, target, setTarget, place, set, filled: slots.filter((x) => x !== null).length };
}

export type LineupState = ReturnType<typeof useLineup>;

/** Campo con le 6 posizioni e lo slot del libero. */
export function LineupField({
  lineup,
  playerOf,
  roleOf,
}: {
  lineup: LineupState;
  playerOf: (id: number) => PickPlayer | undefined;
  /** Ruolo in questa partita (mostrato in piccolo sotto il nome). */
  roleOf: (id: number) => PlayerRole | undefined;
}) {
  const { slots, libero, target, setTarget } = lineup;
  const lib = libero ? playerOf(libero) : undefined;
  const tile = (i: number) => {
    const id = slots[i];
    const p = id !== null ? playerOf(id) : undefined;
    const role = id !== null ? roleOf(id) : undefined;
    const active = target === i;
    return (
      <button
        key={i}
        type="button"
        onClick={() => setTarget(i)}
        aria-pressed={active}
        aria-label={`Posizione P${i + 1}${p ? `: ${fullName(p)}` : ", vuota"}`}
        className={`relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-tile text-ink ${active ? "border border-gold bg-surface-sel" : p ? "border border-line bg-surface" : "border border-dashed border-line-strong bg-surface"}`}
      >
        <span className="absolute top-1.5 left-2 text-[11px] font-semibold text-faint">P{i + 1}</span>
        <span className={`font-display text-[30px] leading-none font-extrabold tabular-nums ${p ? "text-gold" : "text-faint"}`}>
          {p ? p.number : "+"}
        </span>
        <span className="max-w-full truncate px-1 text-xs text-ink-2">{p ? shortName(p) : "vuoto"}</span>
        {p && role && <span className="text-[10px] leading-tight text-faint">{ROLE_LABEL[role]}</span>}
      </button>
    );
  };
  // Stesso mini campo del Live: rete, prima linea, linea dei 3 metri, seconda linea.
  return (
    <div className="flex flex-col gap-1.5 rounded-panel border border-line bg-surface-2 p-3">
      <div aria-hidden className="flex items-center gap-2">
        <span className="h-1 flex-1 rounded-pill bg-ink-2" />
        <span className="text-[10px] font-bold tracking-[.2em] text-muted uppercase">Rete</span>
        <span className="h-1 flex-1 rounded-pill bg-ink-2" />
      </div>
      <span className="text-[10px] font-semibold tracking-[.16em] text-faint uppercase">Prima linea</span>
      <div className="grid grid-cols-3 gap-1.5">{COURT_ORDER.slice(0, 3).map(tile)}</div>
      <div aria-hidden className="my-0.5 border-t-2 border-dashed border-line-strong" />
      <span className="text-[10px] font-semibold tracking-[.16em] text-faint uppercase">Seconda linea</span>
      <div className="grid grid-cols-3 gap-1.5">{COURT_ORDER.slice(3).map(tile)}</div>
      <button
        type="button"
        onClick={() => setTarget("libero")}
        aria-pressed={target === "libero"}
        className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-btn border border-dashed px-3 text-sm text-ink-2 ${target === "libero" ? "border-gold" : "border-line-strong"}`}
      >
        <span className="font-display text-[13px] font-bold tracking-[.12em] text-blue uppercase">Libero</span>
        <span className="font-display text-xl font-extrabold text-gold tabular-nums">{lib ? lib.number : "+"}</span>
        {lib ? fullName(lib) : "Nessuno"}
      </button>
    </div>
  );
}

/** Indicazione di cosa toccare ora. */
export function lineupHint(lineup: LineupState) {
  return lineup.target === "libero" ? "Scegli il libero tra i presenti" : `Tocca un presente per metterlo in P${lineup.target + 1}`;
}

/** Presenti da mettere in campo: quelli già usati sono attenuati, con la posizione accanto. */
export function LineupPool<P extends PickPlayer>({
  lineup,
  players,
  tagOf,
}: {
  lineup: LineupState;
  players: P[];
  /** Etichetta per chi non è ancora in campo (es. il ruolo). */
  tagOf?: (p: P) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map((p) => {
        const pos = lineup.slots.indexOf(p.id);
        const used = pos >= 0 || lineup.libero === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => lineup.place(p.id)}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-btn border bg-surface-2 px-3 text-ink ${used ? "border-line opacity-45" : "border-line-strong"}`}
          >
            <span className="font-display text-xl font-extrabold text-gold tabular-nums">{p.number}</span>
            <span className="text-[13px]">{shortName(p)}</span>
            <span className="text-[11px] text-faint">{lineup.libero === p.id ? "L" : pos >= 0 ? `P${pos + 1}` : (tagOf?.(p) ?? "")}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Avviso del misto (almeno 2 donne in campo): solo informativo, non blocca. */
export function WomenWarning({ ids, genderOf }: { ids: number[]; genderOf: (id: number) => PlayerGender | null }) {
  const w = womenOnCourt(ids, genderOf);
  if (!w.warn) return null;
  return (
    <p role="status" className="rounded-btn border border-red-line px-3 py-2.5 text-sm text-red">
      {w.women + w.unknown < MIN_WOMEN
        ? `In campo ${w.women === 1 ? "c'è 1 donna" : `ci sono ${w.women} donne`}: il regolamento ne chiede almeno ${MIN_WOMEN}.`
        : `Verifica le donne in campo (almeno ${MIN_WOMEN}): sesso non indicato per ${w.unknown} ${w.unknown === 1 ? "giocatore" : "giocatori"}.`}
    </p>
  );
}
