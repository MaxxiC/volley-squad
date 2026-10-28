"use client";

import { clearIfSynced } from "@/lib/live/local-log";
import { clearLivePages } from "@/lib/live/offline-page";

/**
 * Esci: prima cancella dal telefono le pagine del Live salvate e la copia locale delle azioni,
 * ma solo se è già tutto sul server. Con azioni in coda chiede conferma e le lascia sul telefono
 * (ripartono al prossimo accesso).
 */
export function LogoutButton({ logout }: { logout: () => Promise<void> }) {
  const exit = async () => {
    // L'uscita passa dal server: senza rete non si cancella nulla.
    if (!navigator.onLine) {
      window.alert("Serve la rete per uscire.");
      return;
    }
    const pending = await clearIfSynced();
    if (pending > 0) {
      const ok = window.confirm(
        `${pending === 1 ? "C'è 1 azione del Live non ancora inviata" : `Ci sono ${pending} azioni del Live non ancora inviate`} al server. Restano su questo telefono e partono al prossimo accesso. Uscire lo stesso?`,
      );
      if (!ok) return;
    } else {
      await clearLivePages();
    }
    await logout();
  };

  return (
    <form action={exit}>
      <button
        type="submit"
        className="inline-flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-gold hover:text-gold-hover"
      >
        Esci
      </button>
    </form>
  );
}
