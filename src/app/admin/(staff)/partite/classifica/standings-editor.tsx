"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from "@/components/admin/styles";
import { saveStandings } from "./actions";
import { STAT_FIELDS, type StandingDraft } from "./standings-form";

type Props = {
  seasonName: string;
  teamNames: string[];
  initial: StandingDraft[];
};

const emptyRow = (): StandingDraft => ({
  key: crypto.randomUUID(),
  team: "",
  points: "",
  won: "",
  lost: "",
  setsWon: "",
  setsLost: "",
});

const toNumber = (s: string) => (/^\d+$/.test(s) ? Number(s) : 0);

/** Riga senza la chiave interna di React: è ciò che si salva e si confronta. */
const values = (rows: StandingDraft[]) =>
  rows.map((r) => ({ team: r.team, points: r.points, won: r.won, lost: r.lost, setsWon: r.setsWon, setsLost: r.setsLost }));

export function StandingsEditor({ seasonName, teamNames, initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(values(rows)) !== JSON.stringify(values(initial));

  const update = (key: string, field: keyof StandingDraft, value: string) => {
    setMessage(null);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveStandings(values(rows));
      setMessage(res.ok ? { ok: true, text: "Classifica salvata: è già visibile su Home e Calendario." } : { ok: false, text: res.error });
    });

  return (
    <>
      <PageHeader
        kicker={`Stagione ${seasonName}`}
        title="Classifica"
        description="Inserita a mano. Le partite giocate (G) si calcolano da sole: vinte + perse. L'ordine sul sito segue punti, vittorie e quoziente set."
      />

      <datalist id="squadre">
        {teamNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <article key={r.key} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 font-display text-lg font-semibold text-faint tabular-nums">{i + 1}</span>
              <input
                type="text"
                list="squadre"
                aria-label={`Squadra riga ${i + 1}`}
                value={r.team}
                onChange={(e) => update(r.key, "team", e.target.value)}
                placeholder="Nome squadra"
                className={`${INPUT} font-semibold`}
              />
              <button
                type="button"
                aria-label={`Rimuovi ${r.team || `riga ${i + 1}`}`}
                onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                className={`${BTN_DANGER} min-w-11 px-2 text-xl`}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {STAT_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col items-center gap-1">
                  <span className={LABEL}>{f.label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={r[f.key]}
                    onChange={(e) => update(r.key, f.key, e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="0"
                    className={`${INPUT} px-1 text-center font-display text-lg font-bold tabular-nums ${f.key === "points" ? "text-gold" : ""}`}
                  />
                </label>
              ))}
              <div className="flex flex-col items-center gap-1">
                <span className={LABEL}>G</span>
                <span className="flex min-h-12 items-center font-display text-lg font-bold text-muted tabular-nums">
                  {toNumber(r.won) + toNumber(r.lost)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className={`${BTN_SECONDARY} self-start`}>
        + Squadra
      </button>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-[15px] ${message.ok ? "text-gold" : "text-red"}`}>
          {message.text}
        </p>
      )}

      <div className="sticky bottom-0 -mx-admin flex flex-wrap gap-2.5 border-t border-line-soft bg-bg px-admin py-3">
        <button type="button" disabled={pending || !dirty} onClick={save} className={BTN_PRIMARY}>
          {pending ? "Salvo…" : "Salva"}
        </button>
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => {
            setRows(initial);
            setMessage(null);
          }}
          className={BTN_SECONDARY}
        >
          Annulla
        </button>
      </div>
    </>
  );
}
