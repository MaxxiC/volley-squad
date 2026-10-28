"use client";

import { useState } from "react";
import { TEAM_NAME } from "@/lib/club";
import type { Side } from "@/lib/live/skills";
import { MAX_TIMEOUTS, type LiveState } from "@/lib/live/state";
import { PANEL, SMALL_BTN } from "./live-ui";

type Props = {
  live: LiveState;
  opponent: string;
  onTimeout: (side: Side) => void;
  onCorrect: (side: Side, delta: 1 | -1) => void;
};

/** Timeout (2 per squadra per set, oltre si avvisa) e correzione manuale del punteggio. */
export function MatchTools({ live, opponent, onTimeout, onCorrect }: Props) {
  const [correcting, setCorrecting] = useState(false);
  const teams: [Side, string][] = [
    ["us", TEAM_NAME],
    ["them", opponent],
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {teams.map(([side, name]) => {
          const used = live.timeouts[side];
          return (
            <button
              key={side}
              type="button"
              onClick={() => onTimeout(side)}
              className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-btn border px-1 ${used >= MAX_TIMEOUTS ? "border-red-line text-red" : "border-line-strong text-ink"}`}
            >
              <span className="font-display text-xs font-semibold tracking-[.1em] text-muted uppercase">Timeout</span>
              <span className="max-w-full truncate font-display text-[15px] font-bold uppercase">
                {name} {used}/{MAX_TIMEOUTS}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={correcting}
          onClick={() => setCorrecting(!correcting)}
          className={`min-h-12 cursor-pointer rounded-btn border font-display text-[15px] font-bold tracking-[.06em] uppercase ${correcting ? "border-gold text-gold" : "border-line-strong text-ink"}`}
        >
          Correggi
        </button>
      </div>

      {correcting && (
        <section className={`${PANEL} gap-2.5`}>
          <span className="text-[13px] text-muted">
            Per allineare il punteggio a quello dell&apos;arbitro: non cambia rotazione né battuta.
          </span>
          {teams.map(([side, name]) => (
            <div key={side} className="flex items-center gap-2">
              <span className={`mr-auto truncate font-display text-lg font-bold uppercase ${side === "us" ? "text-gold" : "text-ink"}`}>
                {name} {live.score[side]}
              </span>
              <button
                type="button"
                aria-label={`Togli un punto a ${name}`}
                disabled={live.score[side] === 0}
                onClick={() => onCorrect(side, -1)}
                className={`${SMALL_BTN} min-w-13 text-lg`}
              >
                −1
              </button>
              <button type="button" aria-label={`Aggiungi un punto a ${name}`} onClick={() => onCorrect(side, 1)} className={`${SMALL_BTN} min-w-13 text-lg`}>
                +1
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setCorrecting(false)} className={`${SMALL_BTN} self-start`}>
            Fatto
          </button>
        </section>
      )}
    </div>
  );
}
