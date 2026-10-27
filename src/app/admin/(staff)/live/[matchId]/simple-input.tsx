"use client";

import { useState } from "react";
import { TEAM_NAME } from "@/lib/club";
import { SIMPLE_OUR_TYPES, SIMPLE_THEIR_TYPES, type BallType, type Side, type SimpleType } from "@/lib/live/skills";
import type { LiveEvent, LivePlayer } from "@/lib/live/types";
import { shortName } from "@/lib/players";
import { PANEL, SMALL_BTN, starClass, toneClass } from "./live-ui";

type Props = {
  opponent: string;
  /** Evento a cui il pannello si riferisce: se viene annullato, il pannello si chiude da solo. */
  eventOf: (id: string) => LiveEvent | undefined;
  /** Segna subito il punto (incompleto) e restituisce l'evento creato. */
  onPoint: (side: Side) => LiveEvent;
  /** Completa "come" e "chi" del punto. */
  onComplete: (id: string, patch: Partial<LiveEvent>) => void;
  /** Giocatori tra cui scegliere: in campo (P1 per primo) e libero. */
  court: LivePlayer[];
  libero: LivePlayer | undefined;
  /** P1 al momento del punto: è chi batteva (suggerito per ace ed errori in battuta). */
  serverId: number | null;
  /** Ultimo giocatore usato per un certo tipo di punto (README → "ultimo"). */
  lastFor: (type: SimpleType) => number | null;
};

type Panel =
  | { stage: "type"; eventId: string; side: Side }
  | { stage: "ball"; eventId: string; side: Side; type: SimpleType }
  | { stage: "player"; eventId: string; side: Side; type: Extract<SimpleType, { kind: "skill" }> };

export function SimpleInput({ opponent, eventOf, onPoint, onComplete, court, libero, serverId, lastFor }: Props) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [star, setStar] = useState(false);

  // Il pannello vale solo finché il suo punto esiste ed è ancora da completare (Annulla lo chiude).
  const current = panel ? eventOf(panel.eventId) : undefined;
  const open = panel && current && !current.deleted && current.incomplete ? panel : null;

  const close = () => {
    setPanel(null);
    setStar(false);
  };
  const point = (side: Side) => {
    const e = onPoint(side);
    setStar(false);
    setPanel({ stage: "type", eventId: e.id, side });
  };
  const complete = (patch: Partial<LiveEvent>) => {
    if (!open) return;
    onComplete(open.eventId, { ...patch, incomplete: false });
    close();
  };

  const chooseType = (type: SimpleType) => {
    if (!open) return;
    if (type.kind === "opp_point") complete({ skill: "opp_point" });
    else if (type.kind === "opp_error") setPanel({ stage: "ball", eventId: open.eventId, side: open.side, type });
    else setPanel({ stage: "player", eventId: open.eventId, side: open.side, type });
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => point("us")}
            className="flex min-h-37.5 cursor-pointer flex-col items-center justify-center gap-1 rounded-panel bg-gold text-bg active:bg-gold-active"
          >
            <span className="font-display text-[56px] leading-[.9] font-extrabold">+1</span>
            <span className="font-display text-[17px] font-bold tracking-[.12em] uppercase">{TEAM_NAME}</span>
          </button>
          <button
            type="button"
            onClick={() => point("them")}
            className="flex min-h-37.5 cursor-pointer flex-col items-center justify-center gap-1 rounded-panel border border-line-strong bg-surface text-ink active:bg-chip"
          >
            <span className="font-display text-[56px] leading-[.9] font-extrabold">+1</span>
            <span className="max-w-full truncate px-2 font-display text-[17px] font-bold tracking-[.12em] uppercase">{opponent}</span>
          </button>
        </div>
        <span className="text-[13px] text-faint">Il punto si segna subito. Poi puoi aggiungere come è arrivato e chi l&apos;ha fatto.</span>
      </div>
    );
  }

  const title =
    open.stage === "type" ? "Come è arrivato?" : open.stage === "ball" ? `Errore ${opponent} su…` : `${open.type.label} · chi?`;
  const types = open.side === "us" ? SIMPLE_OUR_TYPES : SIMPLE_THEIR_TYPES;
  const last = open.stage === "player" ? lastFor(open.type) : null;
  const suggested = open.stage === "player" && open.type.kind === "skill" && open.type.skill === "serve" ? serverId : null;
  const choices = open.stage === "player" && open.type.includeLibero && libero ? [...court, libero] : court;

  return (
    <section className={PANEL}>
      <div className="flex items-center gap-2.5">
        <span className="mr-auto font-display text-[22px] font-bold uppercase">{title}</span>
        {open.stage !== "type" && (
          <button type="button" onClick={() => setPanel({ stage: "type", eventId: open.eventId, side: open.side })} className={SMALL_BTN}>
            ← Indietro
          </button>
        )}
        <button type="button" onClick={close} className={`${SMALL_BTN} text-muted`}>
          Salta
        </button>
      </div>

      {open.stage === "type" && (
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => {
            const tone = open.side === "us" ? "us" : t.kind === "opp_point" ? null : "them";
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => chooseType(t)}
                className={`min-h-16 cursor-pointer rounded-tile border px-3 py-2 font-display text-lg leading-[1.1] font-bold tracking-[.04em] uppercase active:bg-chip ${toneClass(tone)}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {open.stage === "ball" && (
        <div className="grid grid-cols-2 gap-2">
          {(["free", "rally"] as BallType[]).map((ball) => (
            <button
              key={ball}
              type="button"
              onClick={() => complete({ skill: "opp_error", detail: { ballType: ball } })}
              className={`min-h-16 cursor-pointer rounded-tile border px-3 font-display text-lg font-bold tracking-[.04em] uppercase active:bg-chip ${toneClass(null)}`}
            >
              {ball === "free" ? "Palla semplice" : "Azione"}
            </button>
          ))}
        </div>
      )}

      {open.stage === "player" && (
        <>
          {open.side === "us" && (
            <button type="button" aria-pressed={star} onClick={() => setStar(!star)} className={starClass(star)}>
              ★ Meritevole
            </button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {choices.map((p) => {
              const tag = p.id === suggested ? "battuta" : p.id === last ? "ultimo" : p.id === libero?.id ? "libero" : "";
              const highlight = p.id === suggested || p.id === last;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    open.type.kind === "skill" &&
                    complete({ skill: open.type.skill, outcome: open.type.outcome, playerId: p.id, star: open.side === "us" && star })
                  }
                  className={`relative flex min-h-17 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-tile border text-ink active:border-gold ${highlight ? "border-gold-line bg-surface-sel" : "border-line bg-surface-2"}`}
                >
                  <span className="font-display text-[28px] leading-none font-extrabold text-gold tabular-nums">{p.number}</span>
                  <span className="max-w-full truncate px-1 text-[13px] text-ink-2">{shortName(p)}</span>
                  {tag && (
                    <span className="absolute top-1 right-1.5 text-[10px] font-bold tracking-[.08em] text-gold uppercase">{tag}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
