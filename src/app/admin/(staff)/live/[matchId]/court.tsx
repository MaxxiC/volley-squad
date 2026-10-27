"use client";

import { COURT_ORDER } from "@/lib/lineup";
import type { LiveState } from "@/lib/live/state";
import type { LivePlayer } from "@/lib/live/types";
import { shortName } from "@/lib/players";
import { PANEL, PANEL_TITLE, SMALL_BTN } from "./live-ui";

type Props = {
  live: LiveState;
  playerOf: (id: number) => LivePlayer | undefined;
  /** Giocatore selezionato (modalità avanzata). */
  selected: number | null;
  /** Se presente, i giocatori in campo e il libero si possono toccare. */
  onSelect?: (id: number) => void;
  onRotate: () => void;
};

/** Campo con la rete in alto: P4 P3 P2 / P5 P6 P1, pallino oro su P1 quando battiamo noi. */
export function Court({ live, playerOf, selected, onSelect, onRotate }: Props) {
  const libero = live.liberoId ? playerOf(live.liberoId) : undefined;

  return (
    <section className={PANEL}>
      <div className="flex items-center gap-2">
        <span className={PANEL_TITLE}>In campo · rete in alto</span>
        <button type="button" onClick={onRotate} className={SMALL_BTN}>
          Ruota
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 border-t-3 border-ink-2 pt-2">
        {COURT_ORDER.map((i) => {
          const p = playerOf(live.rotation[i]);
          const isSelected = selected === live.rotation[i];
          return (
            <button
              key={i}
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(live.rotation[i])}
              aria-pressed={onSelect ? isSelected : undefined}
              aria-label={`P${i + 1}: ${p ? `#${p.number} ${shortName(p)}` : "?"}${i === 0 && live.serving === "us" ? ", in battuta" : ""}`}
              className={`relative flex min-h-18 flex-col items-center justify-center gap-0.5 rounded-tile border text-ink enabled:cursor-pointer ${isSelected ? "border-gold bg-surface-sel" : "border-line bg-surface-2"}`}
            >
              <span className="absolute top-1.5 left-2 text-[11px] font-semibold text-faint">P{i + 1}</span>
              {i === 0 && live.serving === "us" && <span className="absolute top-2 right-2 size-2 rounded-full bg-gold" />}
              <span className="font-display text-[28px] leading-none font-extrabold text-gold tabular-nums">{p?.number ?? "?"}</span>
              <span className="max-w-full truncate px-1 text-xs text-ink-2">{p ? shortName(p) : ""}</span>
            </button>
          );
        })}
      </div>

      {libero && (
        <button
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.(libero.id)}
          aria-pressed={onSelect ? selected === libero.id : undefined}
          className={`flex min-h-11 items-center gap-2.5 rounded-btn border border-dashed px-3 text-sm text-ink-2 enabled:cursor-pointer ${selected === libero.id ? "border-gold" : "border-line-strong"}`}
        >
          <span className="font-display text-[13px] font-bold tracking-[.12em] text-blue uppercase">Libero</span>
          <span className="font-display text-xl font-extrabold text-gold tabular-nums">{libero.number}</span>
          {shortName(libero)}
        </button>
      )}
    </section>
  );
}
