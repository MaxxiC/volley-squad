"use client";

import { useEffect, useMemo, useState } from "react";
import { LOGIN_PATH } from "@/auth.config";
import { TEAM_NAME } from "@/lib/club";
import { describeEvent } from "@/lib/live/describe";
import { keepLivePageOffline } from "@/lib/live/offline-page";
import type { SimpleType } from "@/lib/live/skills";
import { computeLive, lastTimeout, type LiveState } from "@/lib/live/state";
import type { LiveEvent, LiveLineup, LivePlayer } from "@/lib/live/types";
import { LIVE_MODE_KEY, type LiveMode } from "../prepare-form";
import { AdvancedInput } from "./advanced-input";
import { Court } from "./court";
import { PANEL, PANEL_TITLE, SMALL_BTN } from "./live-ui";
import { MatchTools } from "./match-tools";
import { MatchEnd, NextSetLineup } from "./set-panels";
import { SimpleInput } from "./simple-input";
import { useLiveEvents, type SyncStatus } from "./use-live-events";

type Props = {
  match: { id: number; title: string; opponent: string; finished: boolean; mvpId: number | null };
  players: LivePlayer[];
  lineups: LiveLineup[];
  /** Id di questo Live (formazione del 1° set): la copia del telefono di un Live precedente si scarta. */
  startId: number | null;
  initialEvents: LiveEvent[];
};

export function LiveBoard({ match, players, lineups, startId, initialEvents }: Props) {
  const { events, add, update, undo, redo, canUndo, canRedo, sync } = useLiveEvents(match.id, startId, initialEvents);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // Con i ruoli il libero entra ed esce da solo sui centrali in seconda linea.
  const live = useMemo(() => computeLive(lineups, events.values(), (id) => byId.get(id)?.role), [lineups, events, byId]);
  const playerOf = (id: number) => byId.get(id);

  const [mode, setMode] = useState<LiveMode>("semplice");
  const [selected, setSelected] = useState<number | null>(null);

  // Dopo il primo caricamento online la pagina si riapre anche senza rete.
  useEffect(() => {
    void keepLivePageOffline();
  }, []);

  // Modalità scelta in Prepara Live (preferenza locale del telefono).
  useEffect(() => {
    try {
      if (localStorage.getItem(LIVE_MODE_KEY) === "avanzato") setMode("avanzato");
    } catch {
      // Storage non disponibile: si resta in modalità semplice.
    }
  }, []);

  if (!live) return <p className="text-muted">Formazione del 1° set mancante: torna a Prepara Live.</p>;

  const changeMode = (next: LiveMode) => {
    setMode(next);
    setSelected(null);
    try {
      localStorage.setItem(LIVE_MODE_KEY, next);
    } catch {
      // Preferenza facoltativa.
    }
  };

  const setN = live.setN;
  const base = { setN, kind: "action" as const };
  const court = live.rotation.map(playerOf).filter((p): p is LivePlayer => Boolean(p));
  const libero = live.liberoId ? playerOf(live.liberoId) : undefined;
  const roleOf = (id: number) => live.roles[id] ?? byId.get(id)?.role ?? "S";
  // Panchina per i cambi: presenti fuori dal campo, esclusi i liberi e chi è sostituito dal libero.
  const bench = players.filter(
    (p) => !live.rotation.includes(p.id) && p.id !== live.liberoId && p.id !== live.liberoFor && roleOf(p.id) !== "L",
  );

  /** Ultimo giocatore usato per quel tipo di punto, in tutta la partita. */
  const lastFor = (type: SimpleType) => {
    if (type.kind !== "skill") return null;
    let found: LiveEvent | undefined;
    for (const e of events.values()) {
      if (!e.deleted && e.playerId && e.skill === type.skill && e.outcome === type.outcome && (!found || e.seq > found.seq)) found = e;
    }
    return found?.playerId ?? null;
  };

  // Set nuovo senza ancora la formazione confermata (dal 2° set in poi).
  const needLineup = !live.matchOver && setN > 1 && live.setNotStarted && !live.timeline.some((t) => t.event.kind === "lineup");
  const playing = !live.matchOver && !needLineup && !match.finished;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-4">
      <div className="flex min-w-0 flex-col gap-3.5">
        <Scoreboard live={live} opponent={match.opponent} />
        <QuickBar onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} sync={sync} />

        {match.finished && (
          <p className="rounded-card border border-gold-line bg-surface-sel p-4 text-sm text-ink-2">
            Partita conclusa: risultato e MVP sono già pubblicati. Le azioni si correggono dallo Storico live.
          </p>
        )}

        {live.matchOver && !match.finished && (
          <MatchEnd
            matchId={match.id}
            live={live}
            players={players}
            pendingSync={sync.pending}
            offline={sync.problem === "offline"}
            initialMvp={match.mvpId}
          />
        )}

        {needLineup && (
          <NextSetLineup
            key={setN}
            live={live}
            opponent={match.opponent}
            players={players}
            onStart={(detail) => add({ setN, kind: "lineup", detail })}
          />
        )}

        {playing && (
          <>
            <div role="group" aria-label="Modalità" className="grid grid-cols-2 gap-1 rounded-tile border border-line p-1">
              {(["semplice", "avanzato"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => changeMode(m)}
                  className={`min-h-11.5 cursor-pointer rounded-seg font-display text-[17px] font-bold tracking-[.1em] uppercase ${mode === m ? "bg-gold text-bg" : "text-muted"}`}
                >
                  {m === "semplice" ? "Semplice" : "Avanzato"}
                </button>
              ))}
            </div>

            {live.setWinner && (
              <div className="flex flex-wrap items-center gap-3 rounded-card border border-gold bg-surface-sel p-4">
                <span className="mr-auto font-display text-xl font-bold uppercase">
                  Set {setN} {live.setWinner === "us" ? "vinto" : "perso"} {live.score.us}–{live.score.them}
                </span>
                <button
                  type="button"
                  onClick={() => add({ setN, kind: "set_end" })}
                  className="min-h-12 cursor-pointer rounded-btn bg-gold px-4.5 font-display text-base font-bold tracking-[.1em] text-bg uppercase hover:bg-gold-hover"
                >
                  Chiudi set
                </button>
              </div>
            )}

            {mode === "semplice" ? (
              <SimpleInput
                opponent={match.opponent}
                eventOf={(id) => events.get(id)}
                onPoint={(side) => add({ ...base, point: side, incomplete: true })}
                onComplete={update}
                onAction={(fields) => add({ ...base, ...fields })}
                court={court}
                libero={libero}
                serverId={live.rotation[0] ?? null}
                lastFor={lastFor}
              />
            ) : (
              <AdvancedInput
                opponent={match.opponent}
                player={selected ? playerOf(selected) : undefined}
                onClearPlayer={() => setSelected(null)}
                onAction={(fields) => {
                  add({ ...base, ...fields });
                  setSelected(null);
                }}
                onOppPoint={() => add({ ...base, skill: "opp_point", point: "them" })}
                onOppError={(type) => add({ ...base, skill: "opp_error", point: "us", detail: { oppError: type } })}
                isLibero={selected !== null && selected === live.liberoId}
              />
            )}

            <MatchTools
              live={live}
              opponent={match.opponent}
              onTimeout={(side, delta) => {
                if (delta === 1) return void add({ setN, kind: "timeout", detail: { side } });
                // −1: si annulla l'ultimo timeout di quella squadra (resta nel registro, come Annulla).
                const last = lastTimeout(events.values(), setN, side);
                if (last) update(last.id, { deleted: true });
              }}
              onCorrect={(side, delta) => add({ setN, kind: "correction", point: side, detail: { delta } })}
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <Court
          live={live}
          playerOf={playerOf}
          bench={bench}
          liberos={players.filter((p) => roleOf(p.id) === "L")}
          roleOf={roleOf}
          selected={mode === "avanzato" ? selected : null}
          onSelect={mode === "avanzato" && playing ? setSelected : undefined}
          onRotate={() => add({ setN, kind: "rotation", detail: { dir: 1 } })}
          onSub={(out, inn, role) => add({ setN, kind: "sub", detail: { out, in: inn, role } })}
          onSwap={(a, b) => add({ setN, kind: "swap", detail: { in: a, out: b } })}
          onLibero={(inn, out) => add({ setN, kind: "libero", detail: out === undefined ? { in: inn } : { in: inn, out } })}
          readOnly={!playing}
        />
        <Feed live={live} describe={(e) => describeEvent(e, playerOf, match.opponent)} />
      </div>
    </div>
  );
}

function Scoreboard({ live, opponent }: { live: LiveState; opponent: string }) {
  const name = "flex items-center gap-1.5 font-display text-[15px] font-bold tracking-[.1em] uppercase";
  const score = "font-display text-[clamp(64px,18vw,88px)] leading-[.9] font-extrabold tabular-nums";
  return (
    <section
      aria-label="Punteggio"
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-panel border border-line bg-surface px-4 py-3.5"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={`${name} text-gold`}>
          {TEAM_NAME}
          <span aria-label={live.serving === "us" ? "in battuta" : undefined} className={`size-2 rounded-full ${live.serving === "us" ? "bg-gold" : ""}`} />
        </span>
        <span className={`${score} text-gold`}>{live.score.us}</span>
      </div>
      <div className="flex flex-col items-center gap-1 px-1">
        <span className="font-display text-[13px] font-semibold tracking-[.16em] text-muted uppercase">
          {live.matchOver ? "Finale" : `Set ${live.setN}`}
        </span>
        <span className="font-display text-[26px] leading-none font-bold tabular-nums">
          {live.sets.us}–{live.sets.them}
        </span>
      </div>
      <div className="flex min-w-0 flex-col items-end gap-0.5">
        <span className={`${name} max-w-full text-ink-2`}>
          <span aria-label={live.serving === "them" ? "in battuta" : undefined} className={`size-2 shrink-0 rounded-full ${live.serving === "them" ? "bg-ink" : ""}`} />
          <span className="truncate">{opponent}</span>
        </span>
        <span className={score}>{live.score.them}</span>
      </div>
    </section>
  );
}

/** Annulla / Ripeti sempre a portata di pollice, con lo stato di invio al server. */
function QuickBar({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  sync,
}: {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  sync: SyncStatus;
}) {
  const queued = `${sync.pending} ${sync.pending === 1 ? "azione" : "azioni"} in coda`;
  const status =
    sync.problem === "offline"
      ? { dot: "bg-red", text: sync.pending > 0 ? `Offline · ${queued}` : "Offline" }
      : sync.problem === "auth"
        ? { dot: "bg-red", text: `Sessione scaduta · ${queued}` }
        : sync.problem === "error"
          ? { dot: "bg-red", text: `Non salvato (${sync.message}) · ${queued}, riprovo` }
          : sync.pending > 0
            ? { dot: "bg-muted", text: "Salvataggio…" }
            : sync.restoring
              ? { dot: "bg-muted", text: "Lettura dal telefono…" }
              : { dot: "bg-green", text: "Sincronizzato" };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onUndo} disabled={!canUndo} className={SMALL_BTN}>
          ↶ Annulla
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} className={SMALL_BTN}>
          ↷ Ripeti
        </button>
        <span role="status" className="ml-auto flex items-center gap-2 text-[13px] text-muted">
          <span className={`size-2 rounded-full ${status.dot}`} />
          {status.text}
        </span>
      </div>
      {sync.problem === "auth" && (
        // Dopo il login si torna qui: le azioni sono sul telefono e ripartono da sole (solo lato client).
        <a
          href={`${LOGIN_PATH}?callbackUrl=${encodeURIComponent(location.pathname)}`}
          className="inline-flex min-h-11 items-center self-end text-sm font-semibold text-gold"
        >
          Rientra per inviarle →
        </a>
      )}
      {sync.rejected.count > 0 && (
        <p role="alert" className="rounded-btn border border-red-line px-3 py-2 text-sm text-red">
          {sync.rejected.count === 1 ? "1 azione scartata" : `${sync.rejected.count} azioni scartate`} dal server
          {sync.rejected.message ? ` (${sync.rejected.message})` : ""}: restano solo su questo telefono, annullale o rifalle.
        </p>
      )}
    </div>
  );
}

function Feed({ live, describe }: { live: LiveState; describe: (e: LiveEvent) => string }) {
  const items = live.timeline.slice(-8).reverse();
  return (
    <section className={`${PANEL} gap-2`}>
      <span className={PANEL_TITLE}>Ultime azioni</span>
      {items.length === 0 && (
        <p className="text-sm text-faint">{live.matchOver ? "Partita finita." : "Ancora nessuna azione in questo set."}</p>
      )}
      {items.map(({ event: e, score }) => (
        <div key={e.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-chip px-1 py-2">
          <span
            className={`font-display text-[17px] font-bold tabular-nums ${e.point === "us" ? "text-gold" : e.point === "them" ? "text-ink" : "text-faint"}`}
          >
            {score.us}–{score.them}
          </span>
          <span className="text-sm leading-[1.3] text-ink-2">{describe(e)}</span>
          <span className={`text-xs font-semibold whitespace-nowrap ${e.incomplete ? "text-red" : "text-gold"}`}>
            {e.incomplete ? "da completare" : e.star ? "★" : ""}
          </span>
        </div>
      ))}
    </section>
  );
}
