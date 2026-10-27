"use client";

import { useState } from "react";
import { BTN_PRIMARY } from "@/components/admin/styles";
import { roundLabel } from "@/lib/matches";
import type { AdminMatch } from "./match-form";
import { MatchEditor } from "./match-editor";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

type Props = {
  seasonName: string;
  matches: AdminMatch[];
  opponents: string[];
  venues: string[];
  timeChips: string[];
};

/** Riga info: "Andata 2ª · n. 8 · Casa · 21:30" oppure "Andata 1ª · n. 3 · Casa · 3–0 · Vinta". */
function infoLine(m: AdminMatch) {
  const parts = [roundLabel(m), ...(m.number ? [`n. ${m.number}`] : []), m.home ? "Casa" : "Trasferta"];
  if (m.status === "finished") {
    const won = m.sets.filter((s) => s.us > s.them).length;
    const lost = m.sets.length - won;
    parts.push(`${won}–${lost}`, won > lost ? "Vinta" : "Persa");
  } else if (m.status === "live") {
    parts.push("In corso");
  } else {
    parts.push(m.time || "Data da definire");
  }
  return parts.join(" · ");
}

export function MatchesManager({ seasonName, matches, opponents, venues, timeChips }: Props) {
  const [openId, setOpenId] = useState<number | "new" | null>(null);
  const editorProps = { timeChips, onClose: () => setOpenId(null) };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-sm font-semibold tracking-[.24em] text-gold uppercase">
            Stagione {seasonName}
          </span>
          <h1 className="font-display text-[clamp(40px,8vw,64px)] leading-[.9] font-extrabold uppercase">Partite</h1>
        </div>
        <button type="button" onClick={() => setOpenId("new")} className={BTN_PRIMARY}>
          + Nuova partita
        </button>
      </div>
      <p className="text-sm text-muted">Le modifiche sono visibili subito su Home e Calendario.</p>

      <datalist id="avversari">
        {opponents.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="palestre">
        {venues.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="flex flex-col gap-2.5">
        {openId === "new" && (
          <article className="overflow-hidden rounded-card border border-gold bg-surface">
            <div className="px-4 py-3.5 font-display text-[19px] font-bold uppercase">Nuova partita</div>
            <MatchEditor {...editorProps} onDuplicated={setOpenId} />
          </article>
        )}

        {matches.map((m) => {
          const open = openId === m.id;
          const [, month, day] = m.date.split("-");
          return (
            <article
              key={m.id}
              className={`overflow-hidden rounded-card border bg-surface ${open ? "border-gold" : "border-line"}`}
            >
              <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3.5">
                <div className="flex h-14 flex-col items-center justify-center rounded-btn bg-surface-sel">
                  <span className="font-display text-2xl leading-none font-extrabold">{m.date ? Number(day) : "?"}</span>
                  <span className="font-display text-xs font-semibold tracking-[.12em] text-muted uppercase">
                    {m.date ? MONTHS[Number(month) - 1] : "data"}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  {/* Su due righe invece che troncato: su telefono il nome avversario è l'informazione chiave. */}
                  <span className="line-clamp-2 font-display text-[19px] leading-[1.05] font-bold uppercase">
                    {m.home ? `CUSBros vs ${m.opponent}` : `${m.opponent} vs CUSBros`}
                  </span>
                  <span className="text-[13px] text-muted">{infoLine(m)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : m.id)}
                  aria-expanded={open}
                  className="min-h-11 cursor-pointer rounded-seg border border-line-strong px-3.5 font-display text-[15px] font-semibold tracking-[.08em] text-ink uppercase hover:border-gold hover:text-gold"
                >
                  {open ? "Chiudi" : "Modifica"}
                </button>
              </div>
              {open && <MatchEditor key={m.id} {...editorProps} match={m} onDuplicated={setOpenId} />}
            </article>
          );
        })}

        {matches.length === 0 && openId !== "new" && (
          <p className="text-base text-muted">Nessuna partita in calendario. Aggiungi la prima con “+ Nuova partita”.</p>
        )}
      </div>
    </>
  );
}
