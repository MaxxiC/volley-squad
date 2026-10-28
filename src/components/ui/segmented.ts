// Controllo segmentato (README → Calendario, filtro): contenitore con bordo e voce attiva oro.

export const SEGMENTED = "flex max-w-full gap-1 self-start rounded-tile border border-line p-1";

export function segmentClass(active: boolean) {
  return `inline-flex min-h-11 cursor-pointer items-center rounded-seg px-4.5 font-display text-base font-semibold tracking-[.08em] whitespace-nowrap uppercase ${
    active ? "bg-gold text-bg hover:text-bg" : "bg-transparent text-ink hover:text-gold"
  }`;
}
