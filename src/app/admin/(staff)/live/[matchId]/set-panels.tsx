"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LineupField, LineupPool, WomenWarning, lineupHint, useLineup } from "@/components/admin/lineup-picker";
import { TEAM_NAME } from "@/lib/club";
import type { Side } from "@/lib/live/skills";
import type { LiveState } from "@/lib/live/state";
import type { EventDetail, LivePlayer } from "@/lib/live/types";
import { clearLocalLog } from "@/lib/live/local-log";
import { shortName } from "@/lib/players";
import { finishMatch } from "../actions";
import { PANEL } from "./live-ui";

const PRIMARY =
  "min-h-13 cursor-pointer rounded-btn bg-gold px-5 font-display text-lg font-bold tracking-[.1em] text-bg uppercase hover:bg-gold-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint";

/**
 * Formazione del set successivo: proposta la rotazione di fine set e chi batte per primo
 * (l'altra squadra rispetto al set prima; al 5° set va scelto dopo il sorteggio).
 */
export function NextSetLineup({
  live,
  opponent,
  players,
  onStart,
}: {
  live: LiveState;
  opponent: string;
  players: LivePlayer[];
  onStart: (detail: EventDetail) => void;
}) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const lineup = useLineup(live.rotation, live.liberoId);
  const [serveFirst, setServeFirst] = useState<Side>(live.serveFirst);
  const ready = lineup.filled === 6;

  return (
    <section className={PANEL}>
      <span className="font-display text-[22px] font-bold uppercase">Formazione set {live.setN}</span>
      <span className="text-sm text-muted">
        Proposta: la rotazione di fine set. {lineupHint(lineup)}.
      </span>
      <LineupField lineup={lineup} playerOf={(id) => byId.get(id)} roleOf={(id) => live.roles[id] ?? byId.get(id)?.role} />
      <LineupPool lineup={lineup} players={players} tagOf={(p) => p.role} />
      <WomenWarning ids={lineup.slots.filter((x): x is number => x !== null)} genderOf={(id) => byId.get(id)?.gender ?? null} />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-[.1em] text-muted uppercase">
          Batte per primo{live.setN === 5 ? " (5° set: dopo il sorteggio)" : ""}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["us", TEAM_NAME],
              ["them", opponent],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={serveFirst === k}
              onClick={() => setServeFirst(k)}
              className={`min-h-13 cursor-pointer truncate rounded-card border px-2 font-display text-lg font-bold uppercase ${serveFirst === k ? "border-gold bg-surface-sel text-gold" : "border-line bg-surface-2 text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!ready}
        onClick={() => onStart({ slots: lineup.slots as number[], liberoId: lineup.libero, serveFirst })}
        className={PRIMARY}
      >
        {ready ? `Inizia set ${live.setN}` : `Mancano ${6 - lineup.filled} in campo`}
      </button>
    </section>
  );
}

/** Fine partita: scelta dell'MVP e chiusura (parziali ricalcolati sul server). */
export function MatchEnd({
  matchId,
  live,
  players,
  pendingSync,
  offline,
}: {
  matchId: number;
  live: LiveState;
  players: LivePlayer[];
  /** Azioni non ancora salvate: si chiude solo quando il server ha tutto. */
  pendingSync: number;
  /** Senza rete non si può chiudere (i parziali si ricalcolano sul server). */
  offline: boolean;
}) {
  const router = useRouter();
  const [mvp, setMvp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const won = live.sets.us > live.sets.them;

  const close = () =>
    startTransition(async () => {
      setError(null);
      // Se la rete cade proprio adesso la server action fallisce: si riprova a mano.
      const res = await finishMatch(matchId, mvp).catch(() => ({ ok: false as const, error: "Rete non disponibile: riprova tra poco" }));
      if (!res.ok) return setError(res.error);
      void clearLocalLog(matchId);
      router.push("/admin/partite");
    });

  return (
    <section className={`${PANEL} border-gold`}>
      <span className="font-display text-[26px] font-extrabold uppercase">
        Partita {won ? "vinta" : "persa"} {live.sets.us}–{live.sets.them}
      </span>
      <span className="text-sm text-ink-2">
        {live.finishedSets.map((s) => `${s.us}–${s.them}`).join(" · ")}
      </span>
      <span className="font-display text-sm font-bold tracking-[.2em] text-gold uppercase">MVP della partita</span>
      <div className="grid grid-cols-3 gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={mvp === p.id}
            onClick={() => setMvp(mvp === p.id ? null : p.id)}
            className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-tile border text-ink ${mvp === p.id ? "border-gold bg-surface-sel" : "border-line bg-surface-2"}`}
          >
            <span className="font-display text-2xl leading-none font-extrabold text-gold tabular-nums">{p.number}</span>
            <span className="max-w-full truncate px-1 text-[13px] text-ink-2">{shortName(p)}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[15px] text-red">
          {error}
        </p>
      )}
      <button type="button" disabled={pending || offline || pendingSync > 0 || mvp === null} onClick={close} className={PRIMARY}>
        {offline ? "Serve la rete per concludere" : pendingSync > 0 ? "Salvataggio azioni…" : pending ? "Chiusura…" : mvp === null ? "Scegli l'MVP" : "Concludi partita"}
      </button>
      <span className="text-[13px] text-faint">
        Dopo la chiusura il risultato compare su Home e Calendario. Gli errori si correggono dallo Storico live.
      </span>
    </section>
  );
}
