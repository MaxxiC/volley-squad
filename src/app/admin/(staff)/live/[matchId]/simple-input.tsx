"use client";

import { useState } from "react";
import { TEAM_NAME } from "@/lib/club";
import { COURT_ORDER } from "@/lib/lineup";
import {
  OPP_ERRORS,
  SIMPLE_OUR_TYPES,
  SIMPLE_RALLY_TYPES,
  SIMPLE_THEIR_TYPES,
  isTeamFault,
  type Side,
  type SimpleType,
} from "@/lib/live/skills";
import type { LiveEvent, LivePlayer } from "@/lib/live/types";
import { shortName } from "@/lib/players";
import { SMALL_BTN, starClass, toneClass } from "./live-ui";

/**
 * Altezza fissa dell'area dei punti: "+1" e pannello "come è arrivato" occupano lo stesso spazio,
 * così ciò che sta sotto non si sposta mentre si segnano i punti.
 */
const STAGE = "flex min-h-[340px] flex-col";

type Props = {
  opponent: string;
  /** Evento a cui il pannello si riferisce: se viene annullato, il pannello si chiude da solo. */
  eventOf: (id: string) => LiveEvent | undefined;
  /** Segna subito il punto (incompleto) e restituisce l'evento creato. */
  onPoint: (side: Side) => LiveEvent;
  /** Completa "come" e "chi" del punto. */
  onComplete: (id: string, patch: Partial<LiveEvent>) => void;
  /** Azione senza punto (es. ricezione, attacco rimasto in gioco), segnata a giocatore scelto. */
  onAction: (fields: Pick<LiveEvent, "skill" | "outcome" | "playerId">) => void;
  /** Giocatori in campo, indice = posizione (P1 per primo), e libero. */
  court: LivePlayer[];
  libero: LivePlayer | undefined;
  /** P1 al momento del punto: è chi batteva (suggerito per ace ed errori in battuta). */
  serverId: number | null;
  /** Ultimo giocatore usato per un certo tipo di punto (README → "ultimo"). */
  lastFor: (type: SimpleType) => number | null;
};

type SkillType = Extract<SimpleType, { kind: "skill" }>;

/** Pannello aperto: per un punto appena segnato (come → chi) o per un'azione senza punto (chi). */
type Panel =
  | { stage: "type"; eventId: string; side: Side }
  | { stage: "opp_error"; eventId: string; side: Side }
  | { stage: "player"; eventId: string; side: Side; type: SkillType }
  | { stage: "rally"; type: SkillType };

export function SimpleInput({ opponent, eventOf, onPoint, onComplete, onAction, court, libero, serverId, lastFor }: Props) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [star, setStar] = useState(false);

  // Il pannello di un punto vale solo finché il punto esiste ed è ancora da completare (Annulla lo chiude).
  const current = panel && panel.stage !== "rally" ? eventOf(panel.eventId) : undefined;
  const open = panel?.stage === "rally" || (current && !current.deleted && current.incomplete) ? panel : null;

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
    if (!open || open.stage === "rally") return;
    onComplete(open.eventId, { ...patch, incomplete: false });
    close();
  };

  const chooseType = (type: SimpleType) => {
    if (!open || open.stage === "rally") return;
    if (type.kind === "opp_point") complete({ skill: "opp_point" });
    else if (type.kind === "opp_error") setPanel({ stage: "opp_error", eventId: open.eventId, side: open.side });
    // Fallo di squadra (es. di posizione): nessun giocatore da scegliere.
    else if (isTeamFault(type.skill, type.outcome)) complete({ skill: type.skill, outcome: type.outcome, playerId: null });
    else setPanel({ stage: "player", eventId: open.eventId, side: open.side, type });
  };

  const choosePlayer = (id: number) => {
    if (!open || (open.stage !== "player" && open.stage !== "rally")) return;
    const { skill, outcome } = open.type;
    if (open.stage === "rally") {
      onAction({ skill, outcome, playerId: id });
      close();
    } else complete({ skill, outcome, playerId: id, star: open.side === "us" && star });
  };

  if (!open) {
    return (
      <div className={`${STAGE} gap-2`}>
        <div className="grid flex-1 grid-cols-2 gap-2.5">
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
        {/* Azioni senza punto: la palla resta in gioco, servono alle statistiche. */}
        <div role="group" aria-label="Azioni senza punto" className="grid grid-cols-3 gap-2">
          {SIMPLE_RALLY_TYPES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setPanel({ stage: "rally", type: t })}
              className="min-h-12 cursor-pointer rounded-tile border border-line-strong bg-surface-2 px-1.5 py-1 font-display text-sm leading-[1.1] font-bold tracking-[.04em] text-ink uppercase active:bg-chip"
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-faint">
          Il punto si segna subito. Poi puoi aggiungere come è arrivato e chi l&apos;ha fatto.
        </span>
      </div>
    );
  }

  const rally = open.stage === "rally";
  const title =
    open.stage === "type"
      ? "Come è arrivato?"
      : open.stage === "opp_error"
        ? `Errore ${opponent}: cosa?`
        : `${open.type.label} · chi?`;
  const types = !rally && open.side === "us" ? SIMPLE_OUR_TYPES : SIMPLE_THEIR_TYPES;
  const choosing = open.stage === "player" || open.stage === "rally" ? open.type : null;
  const last = choosing ? lastFor(choosing) : null;
  const suggested = choosing?.skill === "serve" ? serverId : null;
  // Disposti come il campo del Live (P4 P3 P2 / P5 P6 P1); il libero in panchina in fondo, quando serve.
  const position = (p: LivePlayer) => court.indexOf(p);
  const field = court.length === 6 ? COURT_ORDER.map((i) => court[i]) : court;
  const withLibero = choosing?.includeLibero && libero && !court.includes(libero);
  const choices = withLibero ? [...field, libero] : field;
  const us = !rally && open.side === "us";
  // Colore del pannello: oro = punto nostro, rosso = punto loro, neutro = azione senza punto.
  const frame = rally ? "border-line-strong bg-surface" : us ? "border-gold bg-surface-sel" : "border-red-line bg-surface";

  return (
    <section className={`${STAGE} gap-3.5 rounded-panel border p-3.5 ${frame}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {/* Di chi è il punto: si capisce a colpo d'occhio anche dal colore del pannello. */}
          <span
            className={`mr-auto min-w-0 truncate font-display text-[13px] font-bold tracking-[.16em] uppercase ${rally ? "text-muted" : us ? "text-gold" : "text-red"}`}
          >
            {rally ? "Senza punto" : `+1 ${us ? TEAM_NAME : opponent}`}
          </span>
          {!rally && open.stage !== "type" && (
            <button
              type="button"
              onClick={() => setPanel({ stage: "type", eventId: open.eventId, side: open.side })}
              className={`${SMALL_BTN} whitespace-nowrap`}
            >
              ← Indietro
            </button>
          )}
          <button type="button" onClick={close} className={`${SMALL_BTN} text-muted`}>
            {rally ? "Annulla" : "Salta"}
          </button>
        </div>
        <span className="font-display text-[22px] leading-[1.1] font-bold uppercase">{title}</span>
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
                className={`min-h-14 cursor-pointer rounded-tile border px-3 py-2 font-display text-lg leading-[1.1] font-bold tracking-[.04em] uppercase active:bg-chip ${toneClass(tone)}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {open.stage === "opp_error" && (
        <div className="grid grid-cols-2 gap-2">
          {OPP_ERRORS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => complete({ skill: "opp_error", detail: { oppError: o.key } })}
              className={`min-h-14 cursor-pointer rounded-tile border px-3 py-2 font-display text-lg leading-[1.1] font-bold tracking-[.04em] uppercase active:bg-chip ${toneClass(null)}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {choosing && (
        <>
          {us && (
            <button type="button" aria-pressed={star} onClick={() => setStar(!star)} className={starClass(star)}>
              ★ Meritevole
            </button>
          )}
          <div aria-hidden className="-mb-1 flex items-center gap-2">
            <span className="h-0.5 flex-1 rounded-pill bg-line-strong" />
            <span className="text-[10px] font-bold tracking-[.2em] text-faint uppercase">Rete</span>
            <span className="h-0.5 flex-1 rounded-pill bg-line-strong" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {choices.map((p) => {
              const tag = p.id === suggested ? "battuta" : p.id === last ? "ultimo" : p.id === libero?.id ? "libero" : "";
              const highlight = p.id === suggested || p.id === last;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePlayer(p.id)}
                  className={`relative flex min-h-17 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-tile border text-ink active:border-gold ${highlight ? "border-gold-line bg-surface-sel" : "border-line bg-surface-2"}`}
                >
                  {position(p) >= 0 && (
                    <span aria-hidden className="absolute top-1 left-1.5 text-[10px] font-semibold text-faint">
                      P{position(p) + 1}
                    </span>
                  )}
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
