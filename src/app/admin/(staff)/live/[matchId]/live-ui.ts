// Classi condivise dai pannelli del Live.

export const PANEL = "flex flex-col gap-3.5 rounded-panel border border-line bg-surface p-3.5";

export const PANEL_TITLE = "mr-auto font-display text-sm font-bold tracking-[.2em] text-gold uppercase";

export const SMALL_BTN =
  "min-h-11 cursor-pointer rounded-seg border border-line-strong px-3 font-display text-sm font-semibold tracking-[.08em] text-ink uppercase hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-ink";

/** Toggle "★ Meritevole". */
export function starClass(on: boolean) {
  return `min-h-11 self-start cursor-pointer rounded-pill border px-3.5 font-display text-base font-bold tracking-[.06em] uppercase ${
    on ? "border-gold bg-gold text-bg" : "border-line-strong text-muted"
  }`;
}

/** Bottone esito/tipo: tono positivo (punto nostro), negativo (punto loro) o neutro. */
export function toneClass(tone: "us" | "them" | null, filled = false) {
  if (tone === "us") return filled ? "border-gold bg-gold text-bg" : "border-gold-line bg-surface-2 text-gold";
  if (tone === "them") return "border-red-line bg-surface-2 text-red";
  return "border-line bg-surface-2 text-ink";
}
