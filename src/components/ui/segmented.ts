// Controllo segmentato (README → Calendario, filtro): contenitore con bordo e voce attiva oro.

export const SEGMENTED = "flex max-w-full gap-1 self-start rounded-tile border border-line p-1";

/** Variante a colonne uguali su tutta la larghezza: per voci lunghe che a 320px non starebbero in fila. */
export const SEGMENTED_FILL = "grid w-full max-w-md auto-cols-fr grid-flow-col gap-1 rounded-tile border border-line p-1";

export function segmentClass(active: boolean, fill = false) {
  return `inline-flex min-h-11 cursor-pointer items-center rounded-seg font-display text-base font-semibold whitespace-nowrap uppercase ${
    fill ? "justify-center px-1.5 tracking-[.04em]" : "px-4.5 tracking-[.08em]"
  } ${active ? "bg-gold text-bg hover:text-bg" : "bg-transparent text-ink hover:text-gold"}`;
}
