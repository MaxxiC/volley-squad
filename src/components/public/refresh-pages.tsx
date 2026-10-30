"use client";

// Bottone "Aggiorna" delle pagine pubbliche, visibile solo a chi è entrato nell'area staff: rigenera
// subito statistiche, calendario e riepiloghi invece di aspettare la cache.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { refreshPublicPages } from "@/app/(public)/statistiche/actions";

export function RefreshPages() {
  const router = useRouter();
  const [staff, setStaff] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // La sessione dell'area staff vale anche qui: se c'è, il bottone compare.
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setStaff(Boolean(s?.user)))
      .catch(() => setStaff(false));
  }, []);

  if (!staff) return null;

  const refresh = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await refreshPublicPages().catch(() => null);
      if (!res) return setMessage("Serve la rete per aggiornare");
      if (!res.ok) return setMessage(res.error);
      router.refresh();
      setMessage("Aggiornato");
    });

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-btn border border-gold-line px-3.5 font-display text-[15px] font-semibold tracking-[.08em] text-gold uppercase hover:border-gold disabled:opacity-60"
      >
        {pending ? "Aggiorno…" : "↻ Aggiorna"}
      </button>
      <span role="status" className="text-[13px] text-muted">
        {message ?? "Staff: rigenera subito le pagine pubbliche (altrimenti entro 5 minuti)."}
      </span>
    </div>
  );
}
