"use client";

// Controllo e applicazione del sito ufficiale: prima si vede cosa cambierebbe, poi "Applica".
import { useState, useTransition } from "react";
import { BTN_GOLD_OUTLINE, BTN_PRIMARY } from "@/components/admin/styles";
import { applyOfficial, checkOfficial } from "./actions";
import type { OfficialSummary } from "./ufficiale-form";

export function OfficialSync() {
  const [summary, setSummary] = useState<OfficialSummary | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (task: typeof checkOfficial, after: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await task().catch(() => null);
      if (!res) return setError("Serve la rete per leggere il sito ufficiale");
      if (!res.ok) return setError(res.error);
      setSummary(res.summary);
      setApplied(after);
    });

  const count = summary ? summary.createTeams.length + summary.updates.length + summary.creates.length + (summary.standings.length ? 1 : 0) + (summary.linkTeams ? 1 : 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2.5">
        <button type="button" disabled={pending} onClick={() => run(checkOfficial, false)} className={BTN_GOLD_OUTLINE}>
          {pending && !summary ? "Lettura…" : "Controlla il sito ufficiale"}
        </button>
        {summary && !summary.empty && !applied && (
          <button type="button" disabled={pending} onClick={() => run(applyOfficial, true)} className={BTN_PRIMARY}>
            {pending ? "Applico…" : `Applica ${count === 1 ? "1 modifica" : `${count} modifiche`}`}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[15px] text-red">
          {error}
        </p>
      )}

      {summary && (
        <div role="status" className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4">
          <p className={`text-[15px] ${applied ? "text-green" : "text-ink"}`}>
            {applied
              ? "Fatto: il sito e l'area staff mostrano i dati del sito ufficiale."
              : summary.empty
                ? "Tutto allineato: nessuna differenza con il sito ufficiale."
                : "Differenze con il sito ufficiale (si applicano con il bottone qui sopra):"}
          </p>
          {summary.createTeams.length > 0 && <Group title="Squadre nuove" items={summary.createTeams} />}
          {summary.updates.length > 0 && (
            <Group title="Nostre partite" items={summary.updates.map((u) => `${u.label}: ${u.changes.join(" · ")}`)} />
          )}
          {summary.creates.length > 0 && <Group title="Partite nuove" items={summary.creates} />}
          {summary.standings.length > 0 && <Group title="Classifica" items={summary.standings} />}
          {summary.linkTeams > 0 && (
            <Group title="Collegamento" items={[`${summary.linkTeams} squadre collegate al sito ufficiale (servono per i prossimi aggiornamenti)`]} />
          )}
          {summary.warnings.length > 0 && <Group title="Da controllare (non cambiato)" items={summary.warnings} warn />}
        </div>
      )}
    </div>
  );
}

function Group({ title, items, warn = false }: { title: string; items: string[]; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-xs font-semibold tracking-[.1em] uppercase ${warn ? "text-red" : "text-muted"}`}>{title}</span>
      <ul className="flex flex-col gap-1 text-sm text-ink-2">
        {items.map((it) => (
          <li key={it} className="border-l-2 border-line-strong pl-2.5">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
