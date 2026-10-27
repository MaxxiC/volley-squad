"use client";

import { useState, useTransition } from "react";
import { SegmentedField } from "@/components/admin/segmented-field";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from "@/components/admin/styles";
import type { ActionResult } from "@/lib/actions";
import { PLAYER_ROLES, ROLE_LABEL, type PlayerRole } from "@/lib/players";
import { deletePlayer, savePlayer } from "./actions";
import type { AdminPlayer } from "./player-form";

type Props = {
  /** Assente = nuovo giocatore. */
  player?: AdminPlayer;
  onDone: (id: number) => void;
  onCancel: () => void;
  onDeleted?: () => void;
};

export function PlayerEditor({ player, onDone, onCancel, onDeleted = onCancel }: Props) {
  const [number, setNumber] = useState(player ? String(player.number) : "");
  const [firstName, setFirstName] = useState(player?.firstName ?? "");
  const [lastName, setLastName] = useState(player?.lastName ?? "");
  const [role, setRole] = useState<PlayerRole>(player?.role ?? "S");
  const [active, setActive] = useState(player?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult<{ id: number }>>, done: (id: number) => void) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) done(res.id);
      else setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-4.5">
      <span className="font-display text-[30px] leading-none font-bold uppercase">
        {player ? "Modifica giocatore" : "Nuovo giocatore"}
      </span>

      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Numero</span>
          <input
            type="text"
            inputMode="numeric"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="7"
            className={`${INPUT} text-center font-display text-xl font-extrabold text-gold tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Nome</span>
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Cognome (facoltativo)</span>
        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
      </label>

      <SegmentedField
        label="Ruolo"
        value={role}
        onChange={setRole}
        options={PLAYER_ROLES.map((r) => ({ value: r, label: r }))}
      />
      <span className="-mt-3 text-[13px] text-faint">
        {PLAYER_ROLES.map((r) => `${r} ${ROLE_LABEL[r]}`).join(" · ")}
      </span>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-gold" />
        <span className="text-base">In rosa (attivo)</span>
      </label>

      {error && (
        <p role="alert" className="text-[15px] text-red">
          {error}
        </p>
      )}

      {confirmDelete && player ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-btn border border-red-line p-3">
          <span className="mr-auto text-[15px] text-ink">Eliminare {player.firstName}? Se ha già giocato conviene disattivarlo.</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deletePlayer(player.id), onDeleted)}
            className={`${BTN_DANGER} border border-red-line`}
          >
            Elimina definitivamente
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className={BTN_SECONDARY}>
            No
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => savePlayer({ id: player?.id, number, firstName, lastName, role, active }), onDone)}
            className={BTN_PRIMARY}
          >
            {pending ? "Salvo…" : "Salva"}
          </button>
          <button type="button" onClick={onCancel} className={BTN_SECONDARY}>
            Annulla
          </button>
          {player && (
            <button type="button" onClick={() => setConfirmDelete(true)} className={`${BTN_DANGER} ml-auto`}>
              Elimina
            </button>
          )}
        </div>
      )}
    </div>
  );
}
