// Classi condivise dei controlli dell'area staff (README → Admin, shell comune).

export const INPUT =
  "min-h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink placeholder:text-faint focus:border-gold focus:outline-none";

export const LABEL = "text-xs font-semibold tracking-[.1em] text-muted uppercase";

const BTN = "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-btn font-display text-base tracking-[.1em] whitespace-nowrap uppercase disabled:cursor-not-allowed disabled:opacity-60";

export const BTN_PRIMARY = `${BTN} bg-gold px-5.5 font-bold text-bg hover:bg-gold-hover active:bg-gold-active`;

export const BTN_SECONDARY = `${BTN} border border-line-strong px-4.5 font-semibold text-ink hover:border-ink`;

export const BTN_GOLD_OUTLINE = `${BTN} border border-gold-line px-4 font-semibold text-gold hover:border-gold`;

export const BTN_DANGER = `${BTN} px-3 text-[15px] font-semibold text-red hover:opacity-80`;
