"use client";

// "Azzera il Live" di una partita in corso, con doppia conferma: prima l'avviso di cosa si perde,
// poi il nome dell'avversario scritto a mano (controllato anche dal server).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BTN_DANGER, BTN_SECONDARY, INPUT, LABEL } from "@/components/admin/styles";
import { clearLocalLog } from "@/lib/live/local-log";
import { resetLive } from "./actions";
import { sameName } from "./prepare-form";

export function ResetLive({
  matchId,
  opponent,
  actions,
  finished = false,
}: {
  matchId: number;
  /** Nome completo dell'avversario: va scritto per confermare. */
  opponent: string;
  actions: number;
  /** Partita conclusa: si perdono anche risultato e MVP. */
  finished?: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"closed" | "warn" | "confirm">("closed");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setStage("closed");
    setTyped("");
    setError(null);
  };

  const reset = () =>
    startTransition(async () => {
      setError(null);
      const res = await resetLive({ matchId, confirm: typed }).catch(() => null);
      if (!res) return setError("Serve la rete per azzerare il Live");
      if (!res.ok) return setError(res.error);
      // Via anche la copia del telefono: il prossimo Live riparte da zero.
      await clearLocalLog(matchId);
      router.refresh();
    });

  if (stage === "closed") {
    return (
      <button type="button" onClick={() => setStage("warn")} className={BTN_DANGER}>
        Azzera il Live…
      </button>
    );
  }

  const lost = actions === 1 ? "1 azione registrata" : `${actions} azioni registrate`;
  return (
    <div role="alertdialog" aria-label="Azzera il Live" className="flex w-full flex-col gap-3 rounded-btn border border-red-line bg-bg p-3">
      <p className="text-[15px] text-ink">
        Si cancellano <strong className="text-red">{lost}</strong>, la formazione e i presenti
        {finished ? ", il risultato e l'MVP" : ""} di questa partita, che torna da giocare. <strong>Non si può annullare.</strong>
      </p>

      {stage === "warn" ? (
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setStage("confirm")} className={`${BTN_DANGER} border border-red-line`}>
            Continua
          </button>
          <button type="button" onClick={close} className={BTN_SECONDARY}>
            No
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Per confermare scrivi: {opponent}</span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={opponent}
              className={INPUT}
            />
          </label>
          {error && (
            <p role="alert" className="text-[15px] text-red">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={pending || !sameName(typed, opponent)}
              onClick={reset}
              className={`${BTN_DANGER} border border-red-line`}
            >
              {pending ? "Azzero…" : "Azzera definitivamente"}
            </button>
            <button type="button" onClick={close} className={BTN_SECONDARY}>
              Annulla
            </button>
          </div>
        </>
      )}
    </div>
  );
}
