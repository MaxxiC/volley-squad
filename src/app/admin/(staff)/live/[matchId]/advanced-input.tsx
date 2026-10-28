"use client";

import { useState } from "react";
import { TEAM_NAME } from "@/lib/club";
import { OUTCOMES, SKILLS, SKILL_LABEL, type Skill } from "@/lib/live/skills";
import type { LiveEvent, LivePlayer } from "@/lib/live/types";
import { playerLabel } from "@/lib/live/describe";
import { PANEL, starClass, toneClass } from "./live-ui";

type Props = {
  opponent: string;
  /** Giocatore toccato in campo (o il libero); null = nessuno. */
  player: LivePlayer | undefined;
  onClearPlayer: () => void;
  onAction: (fields: Pick<LiveEvent, "skill" | "outcome" | "point" | "playerId" | "star">) => void;
  onOppPoint: () => void;
  onOppError: () => void;
};

/** Modalità avanzata: giocatore → fondamentale → esito. Dopo l'esito il giocatore si deseleziona. */
export function AdvancedInput({ opponent, player, onClearPlayer, onAction, onOppPoint, onOppError }: Props) {
  const [skill, setSkill] = useState<Skill>("serve");
  const [star, setStar] = useState(false);

  return (
    <section className={PANEL}>
      {/* Alta come il bottone ×: selezionando un giocatore la riga non cambia altezza. */}
      <div className="flex min-h-11 items-center gap-2.5">
        <span className="text-[13px] font-semibold tracking-[.1em] text-muted uppercase">Giocatore</span>
        <span className={`mr-auto font-display text-xl font-bold uppercase ${player ? "text-gold" : "text-faint"}`}>
          {player ? playerLabel(player) : "Tocca un giocatore in campo"}
        </span>
        {player && (
          <button type="button" onClick={onClearPlayer} aria-label="Deseleziona giocatore" className="size-11 cursor-pointer text-xl text-muted">
            ×
          </button>
        )}
      </div>

      <div role="group" aria-label="Fondamentale" className="grid grid-cols-3 gap-1.5">
        {SKILLS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={skill === k}
            onClick={() => setSkill(k)}
            className={`min-h-11.5 cursor-pointer rounded-btn border font-display text-base font-bold tracking-[.06em] uppercase ${skill === k ? "border-gold bg-gold text-bg" : "border-line text-ink"}`}
          >
            {SKILL_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OUTCOMES[skill].map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={!player}
            onClick={() => {
              if (!player) return;
              onAction({ skill, outcome: o.key, point: o.point, playerId: player.id, star });
              setStar(false);
            }}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-tile border px-2.5 py-1.5 enabled:cursor-pointer enabled:active:opacity-80 disabled:opacity-40 ${toneClass(o.point, true)}`}
          >
            <span className="font-display text-[19px] leading-none font-bold tracking-[.04em] uppercase">{o.label}</span>
            <span className="text-xs opacity-80">
              {o.point === "us" ? `+1 ${TEAM_NAME}` : o.point === "them" ? "+1 Avv" : "continua"}
            </span>
          </button>
        ))}
      </div>

      <button type="button" aria-pressed={star} onClick={() => setStar(!star)} className={starClass(star)}>
        ★ Meritevole
      </button>

      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={onOppPoint}
          className="min-h-13 cursor-pointer truncate rounded-tile border border-line-strong px-2 font-display text-base font-bold tracking-[.06em] text-ink uppercase"
        >
          Punto {opponent}
        </button>
        <button
          type="button"
          onClick={onOppError}
          className="min-h-13 cursor-pointer truncate rounded-tile border border-gold-line px-2 font-display text-base font-bold tracking-[.06em] text-gold uppercase"
        >
          Errore {opponent}
        </button>
      </div>
    </section>
  );
}
