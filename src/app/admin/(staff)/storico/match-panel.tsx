"use client";

// Pannello di una partita conclusa nello Storico: MVP (scelto o cambiato dopo la chiusura),
// "Riapri nel Live" per una chiusura fatta per sbaglio, "Azzera il Live" con doppia conferma.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BTN_GOLD_OUTLINE, BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from "@/components/admin/styles";
import type { LivePlayer } from "@/lib/live/types";
import { fullName } from "@/lib/players";
import { ResetLive } from "../live/reset-live";
import { reopenMatch, setMvp } from "./actions";

type Props = {
  match: { id: number; opponentName: string; mvpId: number | null; actions: number };
  players: LivePlayer[];
};

export function MatchPanel({ match, players }: Props) {
  const router = useRouter();
  const [mvp, setMvpValue] = useState<number | null>(match.mvpId);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (task: () => Promise<{ ok: true } | { ok: false; error: string }>, done: () => void) =>
    startTransition(async () => {
      setMessage(null);
      const res = await task().catch(() => null);
      if (!res) return setMessage({ ok: false, text: "Serve la rete per salvare" });
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      done();
    });

  return (
    <section className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4">
      <span className="font-display text-sm font-bold tracking-[.2em] text-gold uppercase">Partita</span>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
          <span className={LABEL}>MVP della partita</span>
          <select value={mvp ?? ""} onChange={(e) => setMvpValue(e.target.value ? Number(e.target.value) : null)} className={INPUT}>
            <option value="">— Nessuno —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} {fullName(p)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || mvp === match.mvpId}
          onClick={() =>
            run(
              () => setMvp({ matchId: match.id, mvpId: mvp }),
              () => {
                setMessage({ ok: true, text: "MVP salvato" });
                router.refresh();
              },
            )
          }
          className={BTN_PRIMARY}
        >
          Salva MVP
        </button>
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-[15px] ${message.ok ? "text-green" : "text-red"}`}>
          {message.text}
        </p>
      )}

      {confirmReopen ? (
        <div className="flex flex-col gap-2.5 rounded-btn border border-gold-line p-3">
          <p className="text-[15px] text-ink">
            La partita torna <strong>in corso</strong> con tutte le sue azioni: risultato e parziali escono dal sito finché non la
            concludi di nuovo dal Live.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => reopenMatch({ matchId: match.id }), () => router.push(`/admin/live/${match.id}`))}
              className={BTN_GOLD_OUTLINE}
            >
              {pending ? "Riapro…" : "Riapri nel Live"}
            </button>
            <button type="button" onClick={() => setConfirmReopen(false)} className={BTN_SECONDARY}>
              No
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setConfirmReopen(true)} className={BTN_SECONDARY}>
            Riapri nel Live…
          </button>
          <ResetLive matchId={match.id} opponent={match.opponentName} actions={match.actions} finished />
        </div>
      )}
    </section>
  );
}
