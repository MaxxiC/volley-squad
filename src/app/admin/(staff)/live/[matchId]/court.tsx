"use client";

import { useState } from "react";
import { WomenWarning } from "@/components/admin/lineup-picker";
import { COURT_ORDER } from "@/lib/lineup";
import { BACK_ROW, MAX_SUBS, liberoTarget, subWarning, type LiveState } from "@/lib/live/state";
import type { LivePlayer } from "@/lib/live/types";
import { playerLabel } from "@/lib/live/describe";
import { PLAYER_ROLES, ROLE_LABEL, shortName, type PlayerRole } from "@/lib/players";
import { PANEL_TITLE, SMALL_BTN } from "./live-ui";

type Props = {
  live: LiveState;
  playerOf: (id: number) => LivePlayer | undefined;
  /** Presenti in panchina disponibili per i cambi (esclusi liberi e chi è sostituito dal libero). */
  bench: LivePlayer[];
  /** Presenti con ruolo libero in questa partita (per scegliere o scambiare il libero). */
  liberos: LivePlayer[];
  /** Ruolo attuale di un giocatore in questa partita. */
  roleOf: (id: number) => PlayerRole;
  /** Giocatore selezionato (modalità avanzata). */
  selected: number | null;
  /** Se presente, toccare un giocatore lo seleziona (modalità avanzata). */
  onSelect?: (id: number) => void;
  onRotate: () => void;
  onSub: (out: number, inn: number, role: PlayerRole) => void;
  /** Libero: entra / esce / scambio A ↔ B; senza `out` = libero scelto (posto vuoto). */
  onLibero: (inn: number, out?: number) => void;
  /** Solo visualizzazione: a partita finita o mentre si sceglie la formazione del set. */
  readOnly?: boolean;
};

/** Operazione in corso sul campo: cambio (chi esce → chi entra → ruolo) o entrata del libero. */
type Action = { kind: "sub"; out: number | null; inn: number | null; role: PlayerRole | null } | { kind: "libero" } | null;

/** Campo con la rete in alto: P4 P3 P2 / P5 P6 P1, pallino oro su P1 quando battiamo noi; sotto il posto del libero. */
export function Court({ live, playerOf, bench, liberos, roleOf, selected, onSelect, onRotate, onSub, onLibero, readOnly = false }: Props) {
  const [action, setAction] = useState<Action>(null);
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
  const liberoMode = action?.kind === "libero";
  const title = sub ? "Cambio in corso" : liberoMode ? "Entra il libero" : "In campo";
  // Come il pannello dei punti: il colore dice cosa si sta facendo (oro = cambio, blu = libero).
  const frame = sub ? "border-gold bg-surface-sel" : liberoMode ? "border-blue bg-surface" : "border-line bg-surface";

  const tile = (i: number) => {
    const id = live.rotation[i];
    const p = playerOf(id);
    const isSelected = sub ? sub.out === id : selected === id;
    const isOut = Boolean(sub && sub.out === id);
    const isLibero = id === live.liberoId;
    const look = isOut
      ? "border-red bg-surface-2"
      : isSelected
        ? "border-gold bg-surface-sel"
        : isLibero || (liberoMode && tappable(id))
          ? "border-dashed border-blue bg-surface-2"
          : "border-line bg-surface";
    return (
      <button
        key={i}
        type="button"
        disabled={!tappable(id)}
        onClick={() => tapPlayer(id)}
        aria-pressed={tappable(id) ? isSelected : undefined}
        aria-label={`P${i + 1}: ${p ? playerLabel(p) : "?"}${isLibero ? " (libero)" : ""}${i === 0 && live.serving === "us" ? ", in battuta" : ""}`}
        className={`relative flex min-h-19 flex-col items-center justify-center rounded-tile border text-ink enabled:cursor-pointer ${look} ${action && !tappable(id) ? "disabled:opacity-40" : "disabled:opacity-100"}`}
      >
        <span className="absolute top-1.5 left-2 text-[11px] font-semibold text-faint">P{i + 1}</span>
        {isOut && <span className="absolute top-1 right-1.5 text-[10px] font-bold tracking-[.08em] text-red uppercase">esce</span>}
        {i === 0 && live.serving === "us" && <span className="absolute top-2 right-2 size-2 rounded-full bg-gold" />}
        <span className="font-display text-[26px] leading-none font-extrabold text-gold tabular-nums">{p?.number ?? "?"}</span>
        <span className={`max-w-full truncate px-1 text-xs ${isLibero ? "text-blue" : "text-ink-2"}`}>{p ? shortName(p) : ""}</span>
        <span className={`text-[10px] leading-tight ${isLibero ? "text-blue" : "text-faint"}`}>{ROLE_LABEL[isLibero ? "L" : roleOf(id)]}</span>
      </button>
    );
  };

  return (
    <section className={`flex flex-col gap-3.5 rounded-panel border p-3.5 ${frame}`}>
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

      {/* Mini campo: rete, prima linea, linea dei 3 metri, seconda linea (dove può stare il libero). */}
      <div className="flex flex-col gap-1.5 rounded-tile border border-line-strong bg-surface-2 p-2">
        <div aria-hidden className="flex items-center gap-2">
          <span className="h-1 flex-1 rounded-pill bg-ink-2" />
          <span className="text-[10px] font-bold tracking-[.2em] text-muted uppercase">Rete</span>
          <span className="h-1 flex-1 rounded-pill bg-ink-2" />
        </div>
        <span className="text-[10px] font-semibold tracking-[.16em] text-faint uppercase">Prima linea</span>
        <div className="grid grid-cols-3 gap-1.5">{COURT_ORDER.slice(0, 3).map(tile)}</div>
        <div aria-hidden className="my-0.5 border-t-2 border-dashed border-line-strong" />
        <span className="text-[10px] font-semibold tracking-[.16em] text-faint uppercase">Seconda linea</span>
        <div className="grid grid-cols-3 gap-1.5">{COURT_ORDER.slice(3).map(tile)}</div>
      </div>

      {!sub && (
        <LiberoSlot
          live={live}
          playerOf={playerOf}
          liberos={liberos}
          target={liberoTarget(live, roleOf)}
          choosing={liberoMode}
          readOnly={readOnly}
          onChoose={() => setAction(liberoMode ? null : { kind: "libero" })}
          onLibero={(inn, out) => {
            onLibero(inn, out);
            setAction(null);
          }}
        />
      )}

      <WomenWarning ids={live.rotation} genderOf={(id) => playerOf(id)?.gender ?? null} />

      {sub && (
        <div className="flex flex-col gap-2.5 border-t border-gold-line pt-2.5">
          {/* Riepilogo sempre visibile: chi esce (rosso) → chi entra (verde), con cosa manca ancora. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <SubSlot label="Esce" tone="out" player={sub.out ? playerOf(sub.out) : undefined} hint="Tocca in campo" />
            <span aria-hidden className="font-display text-xl text-faint">→</span>
            <SubSlot label="Entra" tone="in" player={sub.inn ? playerOf(sub.inn) : undefined} hint={sub.out ? "Scegli qui sotto" : "Dalla panchina"} />
          </div>
          {sub.out && (
            <div className="grid grid-cols-3 gap-2">
              {bench.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={sub.inn === p.id}
                  onClick={() => sub.out && setAction({ ...sub, inn: p.id, role: roleOf(sub.out) })}
                  className={`flex min-h-17 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-tile border text-ink ${sub.inn === p.id ? "border-green bg-surface-sel" : "border-line bg-surface-2"}`}
                >
                  <span className="font-display text-[26px] leading-none font-extrabold text-gold tabular-nums">{p.number}</span>
                  <span className="max-w-full truncate px-1 text-[13px] text-ink-2">{shortName(p)}</span>
                  <span className="text-[11px] text-faint">{ROLE_LABEL[roleOf(p.id)]}</span>
                </button>
              ))}
              {bench.length === 0 && <span className="col-span-3 text-sm text-faint">Nessuno in panchina.</span>}
            </div>
          )}
          {sub.out && sub.inn && sub.role && (
            <>
              <span className="text-[13px] font-semibold tracking-[.1em] text-muted uppercase">In che ruolo entra?</span>
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

/** Metà del riepilogo del cambio: chi esce (rosso) o chi entra (verde); vuota dice cosa fare. */
function SubSlot({ label, tone, player, hint }: { label: string; tone: "out" | "in"; player: LivePlayer | undefined; hint: string }) {
  const border = !player ? "border-dashed border-line-strong" : tone === "out" ? "border-red" : "border-green";
  return (
    <div className={`flex min-h-14 min-w-0 flex-col justify-center rounded-tile border px-2.5 py-1.5 ${border}`}>
      <span className={`font-display text-xs font-bold tracking-[.14em] uppercase ${tone === "out" ? "text-red" : "text-green"}`}>
        {label}
      </span>
      {player ? (
        <span className="truncate font-display text-lg leading-tight font-bold">{playerLabel(player)}</span>
      ) : (
        <span className="truncate text-[13px] text-faint">{hint}</span>
      )}
    </div>
  );
}

/**
 * Settimo posto, sempre visibile: il libero (si gioca quasi sempre in 7). Da qui entra con un tocco
 * per il centrale in seconda linea (o per chi si sceglie), esce, si scambia con l'altro libero o si
 * sceglie se manca. Niente di tutto questo conta come cambio.
 */
function LiberoSlot({
  live,
  playerOf,
  liberos,
  target,
  choosing,
  readOnly,
  onChoose,
  onLibero,
}: {
  live: LiveState;
  playerOf: (id: number) => LivePlayer | undefined;
  /** Presenti con ruolo libero in questa partita. */
  liberos: LivePlayer[];
  /** Proposta per l'entrata: il centrale in seconda linea (null = nessuno adatto). */
  target: number | null;
  /** Si sta scegliendo in campo chi esce per il libero. */
  choosing: boolean;
  readOnly: boolean;
  onChoose: () => void;
  onLibero: (inn: number, out?: number) => void;
}) {
  const libero = live.liberoId ? playerOf(live.liberoId) : undefined;
  const onCourt = live.liberoFor !== null;
  const others = liberos.filter((p) => p.id !== live.liberoId);
  const replaced = live.liberoFor ? playerOf(live.liberoFor) : undefined;
  const targetPlayer = target ? playerOf(target) : undefined;
  const ACTION = "min-h-11 cursor-pointer rounded-btn border px-2.5 font-display text-sm font-bold tracking-[.06em] uppercase";

  return (
    <div className={`flex flex-col gap-2 rounded-tile border border-dashed p-2.5 ${choosing ? "border-blue bg-surface-2" : "border-blue/60"}`}>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[13px] font-bold tracking-[.12em] text-blue uppercase">Libero</span>
          {libero ? (
            <>
              <span className="font-display text-2xl leading-none font-extrabold text-gold tabular-nums">{libero.number}</span>
              <span className="min-w-0 truncate text-sm text-ink">{shortName(libero)}</span>
            </>
          ) : (
            <span className="text-sm text-faint">nessuno</span>
          )}
        </div>
        <span className={`text-[13px] ${choosing || onCourt ? "text-blue" : "text-muted"}`}>
          {choosing
            ? "Tocca in campo chi esce (seconda linea)"
            : onCourt
              ? `In campo al posto di ${playerLabel(replaced)}`
              : libero
                ? "In panchina"
                : "Scegli chi fa il libero in questo set"}
        </span>
      </div>

      {!readOnly && (
        <div className="grid grid-cols-2 gap-1.5">
          {!libero &&
            (liberos.length ? (
              liberos.map((p) => (
                <button key={p.id} type="button" onClick={() => onLibero(p.id)} className={`${ACTION} border-blue text-blue`}>
                  Scegli {playerLabel(p)}
                </button>
              ))
            ) : (
              <span className="col-span-2 text-[13px] text-faint">Nessun libero tra i presenti.</span>
            ))}

          {libero && onCourt && replaced && (
            <button type="button" onClick={() => onLibero(replaced.id, libero.id)} className={`${ACTION} col-span-2 border-blue bg-blue text-bg`}>
              Esce · rientra {playerLabel(replaced)}
            </button>
          )}

          {libero && !onCourt && !choosing && targetPlayer && (
            <button type="button" onClick={() => onLibero(libero.id, targetPlayer.id)} className={`${ACTION} col-span-2 border-blue bg-blue text-bg`}>
              Entra per {playerLabel(targetPlayer)} (centrale)
            </button>
          )}
          {libero && !onCourt && (
            <button type="button" aria-pressed={choosing} onClick={onChoose} className={`${ACTION} ${choosing ? "col-span-2 border-blue text-blue" : "border-line-strong text-ink"}`}>
              {choosing ? "Annulla" : targetPlayer ? "Per un altro…" : "Fai entrare…"}
            </button>
          )}

          {libero &&
            !choosing &&
            others.map((p) => (
              <button key={p.id} type="button" onClick={() => onLibero(p.id, libero.id)} className={`${ACTION} border-line-strong text-ink`}>
                Cambia con {playerLabel(p)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
