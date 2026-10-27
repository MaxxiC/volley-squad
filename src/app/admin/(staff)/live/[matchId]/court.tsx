"use client";

import { useState } from "react";
import { WomenWarning } from "@/components/admin/lineup-picker";
import { COURT_ORDER } from "@/lib/lineup";
import { BACK_ROW, MAX_SUBS, subWarning, type LiveState } from "@/lib/live/state";
import type { LivePlayer } from "@/lib/live/types";
import { playerLabel } from "@/lib/live/describe";
import { PLAYER_ROLES, ROLE_LABEL, shortName, type PlayerRole } from "@/lib/players";
import { PANEL, PANEL_TITLE, SMALL_BTN } from "./live-ui";

type Props = {
  live: LiveState;
  playerOf: (id: number) => LivePlayer | undefined;
  /** Presenti in panchina disponibili per i cambi (esclusi liberi e chi è sostituito dal libero). */
  bench: LivePlayer[];
  /** Ruolo attuale di un giocatore in questa partita. */
  roleOf: (id: number) => PlayerRole;
  /** Giocatore selezionato (modalità avanzata). */
  selected: number | null;
  /** Se presente, toccare un giocatore lo seleziona (modalità avanzata). */
  onSelect?: (id: number) => void;
  onRotate: () => void;
  onSub: (out: number, inn: number, role: PlayerRole) => void;
  onLibero: (inn: number, out: number) => void;
  /** Solo visualizzazione: a partita finita o mentre si sceglie la formazione del set. */
  readOnly?: boolean;
};

/** Operazione in corso sul campo: cambio (chi esce → chi entra → ruolo) o entrata del libero. */
type Action = { kind: "sub"; out: number | null; inn: number | null; role: PlayerRole | null } | { kind: "libero" } | null;

/** Campo con la rete in alto: P4 P3 P2 / P5 P6 P1, pallino oro su P1 quando battiamo noi. */
export function Court({ live, playerOf, bench, roleOf, selected, onSelect, onRotate, onSub, onLibero, readOnly = false }: Props) {
  const [action, setAction] = useState<Action>(null);
  const libero = live.liberoId ? playerOf(live.liberoId) : undefined;
  const liberoOnCourt = live.liberoFor !== null;
  const back = new Set<number>(BACK_ROW.map((i) => live.rotation[i]));

  const tapPlayer = (id: number) => {
    if (action?.kind === "sub") setAction({ kind: "sub", out: id, inn: null, role: null });
    else if (action?.kind === "libero" && live.liberoId && back.has(id) && id !== live.liberoId) {
      onLibero(live.liberoId, id);
      setAction(null);
    } else onSelect?.(id);
  };
  const tappable = (id: number) =>
    action?.kind === "sub" ? id !== live.liberoId : action?.kind === "libero" ? back.has(id) && id !== live.liberoId : Boolean(onSelect);

  const sub = action?.kind === "sub" ? action : null;
  const warning = sub?.out && sub.inn ? subWarning(live, sub.out, sub.inn) : null;
  const title = sub ? "Cambio in corso" : action?.kind === "libero" ? "Entra il libero" : "In campo · rete in alto";

  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={PANEL_TITLE}>{title}</span>
        {!readOnly && (
          <>
            <button type="button" onClick={onRotate} disabled={action !== null} className={SMALL_BTN}>
              Ruota
            </button>
            <button
              type="button"
              aria-pressed={sub !== null}
              onClick={() => setAction(sub ? null : { kind: "sub", out: null, inn: null, role: null })}
              className={`${SMALL_BTN} ${sub ? "border-gold bg-gold text-bg hover:text-bg" : live.subs >= MAX_SUBS ? "text-red" : ""}`}
            >
              Cambio {live.subs}/{MAX_SUBS}
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 border-t-3 border-ink-2 pt-2">
        {COURT_ORDER.map((i) => {
          const id = live.rotation[i];
          const p = playerOf(id);
          const isSelected = sub ? sub.out === id : selected === id;
          const isLibero = id === live.liberoId;
          return (
            <button
              key={i}
              type="button"
              disabled={!tappable(id)}
              onClick={() => tapPlayer(id)}
              aria-pressed={tappable(id) ? isSelected : undefined}
              aria-label={`P${i + 1}: ${p ? playerLabel(p) : "?"}${isLibero ? " (libero)" : ""}${i === 0 && live.serving === "us" ? ", in battuta" : ""}`}
              className={`relative flex min-h-18 flex-col items-center justify-center gap-0.5 rounded-tile border text-ink enabled:cursor-pointer disabled:opacity-100 ${isSelected ? "border-gold bg-surface-sel" : isLibero ? "border-dashed border-blue bg-surface-2" : "border-line bg-surface-2"} ${action && !tappable(id) ? "opacity-40" : ""}`}
            >
              <span className="absolute top-1.5 left-2 text-[11px] font-semibold text-faint">P{i + 1}</span>
              {i === 0 && live.serving === "us" && <span className="absolute top-2 right-2 size-2 rounded-full bg-gold" />}
              <span className="font-display text-[28px] leading-none font-extrabold text-gold tabular-nums">{p?.number ?? "?"}</span>
              <span className={`max-w-full truncate px-1 text-xs ${isLibero ? "text-blue" : "text-ink-2"}`}>
                {p ? shortName(p) : ""}
              </span>
            </button>
          );
        })}
      </div>

      {libero &&
        !readOnly &&
        (liberoOnCourt ? (
          <button
            type="button"
            disabled={action !== null}
            onClick={() => live.liberoFor && onLibero(live.liberoFor, libero.id)}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-btn border border-dashed border-blue px-3 text-left text-sm text-ink-2 disabled:opacity-40"
          >
            <span className="font-display text-[13px] font-bold tracking-[.12em] text-blue uppercase">Libero in campo</span>
            <span className="ml-auto">
              Esce, rientra {playerLabel(live.liberoFor ? playerOf(live.liberoFor) : undefined)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            aria-pressed={action?.kind === "libero"}
            onClick={() => setAction(action?.kind === "libero" ? null : { kind: "libero" })}
            disabled={sub !== null}
            className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-btn border border-dashed px-3 text-left text-sm text-ink-2 disabled:opacity-40 ${action?.kind === "libero" ? "border-gold" : "border-line-strong"}`}
          >
            <span className="font-display text-[13px] font-bold tracking-[.12em] text-blue uppercase">Libero</span>
            <span className="font-display text-xl font-extrabold text-gold tabular-nums">{libero.number}</span>
            {shortName(libero)}
            <span className="ml-auto text-[13px] text-muted">
              {action?.kind === "libero" ? "Tocca chi esce in seconda linea" : "Fai entrare"}
            </span>
          </button>
        ))}

      <WomenWarning ids={live.rotation} genderOf={(id) => playerOf(id)?.gender ?? null} />

      {sub && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-2.5">
          <span className="text-[13px] text-muted">
            {!sub.out
              ? "Tocca in campo chi esce"
              : !sub.inn
                ? `Esce ${playerLabel(playerOf(sub.out))} · scegli chi entra`
                : `Entra ${playerLabel(playerOf(sub.inn))} per ${playerLabel(playerOf(sub.out))} · in che ruolo?`}
          </span>
          {sub.out && (
            <div className="flex flex-wrap gap-1.5">
              {bench.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={sub.inn === p.id}
                  onClick={() => sub.out && setAction({ ...sub, inn: p.id, role: roleOf(sub.out) })}
                  className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-btn border bg-surface-2 px-3 text-ink ${sub.inn === p.id ? "border-gold" : "border-line-strong"}`}
                >
                  <span className="font-display text-xl font-extrabold text-gold tabular-nums">{p.number}</span>
                  <span className="text-[13px]">{shortName(p)}</span>
                  <span className="text-[11px] text-faint">{roleOf(p.id)}</span>
                </button>
              ))}
              {bench.length === 0 && <span className="text-sm text-faint">Nessuno in panchina.</span>}
            </div>
          )}
          {sub.out && sub.inn && sub.role && (
            <>
              <div role="group" aria-label="Ruolo di chi entra" className="grid grid-cols-4 gap-1">
                {PLAYER_ROLES.filter((r) => r !== "L").map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={sub.role === r}
                    onClick={() => setAction({ ...sub, role: r })}
                    className={`min-h-11 cursor-pointer rounded-chip px-1 font-display text-sm font-bold uppercase ${sub.role === r ? "bg-gold text-bg" : "border border-line-strong text-ink"}`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              {warning && (
                <p role="status" className="rounded-btn border border-red-line px-3 py-2 text-sm text-red">
                  {warning}. Puoi confermare lo stesso.
                </p>
              )}
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!(sub.out && sub.inn && sub.role)}
              onClick={() => {
                if (!(sub.out && sub.inn && sub.role)) return;
                onSub(sub.out, sub.inn, sub.role);
                setAction(null);
              }}
              className="min-h-12 flex-1 cursor-pointer rounded-btn bg-gold font-display text-base font-bold tracking-[.1em] text-bg uppercase disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
            >
              Conferma cambio
            </button>
            <button type="button" onClick={() => setAction(null)} className={SMALL_BTN}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
