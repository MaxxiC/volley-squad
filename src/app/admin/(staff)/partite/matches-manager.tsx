"use client";

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { BTN_PRIMARY } from "@/components/admin/styles";
import { MatchTitle } from "@/components/ui/match-title";
import { TEAM_NAME } from "@/lib/club";
import { matchScore, roundLabel } from "@/lib/matches";
import type { AdminMatch } from "./match-form";
import { MatchEditor } from "./match-editor";

type Props = {
  seasonName: string;
  matches: AdminMatch[];
  opponents: string[];
  venues: string[];
  timeChips: string[];
};

/** Riga info: "Andata 2ª · n. 8 · Casa · 21:30" oppure "Andata 1ª · n. 3 · Casa · Vinta" (il punteggio è nel riquadro). */
function infoLine(m: AdminMatch) {
  const parts = [roundLabel(m), ...(m.number ? [`n. ${m.number}`] : []), m.home ? "Casa" : "Trasferta"];
  if (m.status === "finished") {
    parts.push(`${matchScore(m.sets).won ? "Vinta" : "Persa"}${m.forfeit ? " a tavolino" : ""}`);
  } else if (m.status === "live") {
    parts.push("In corso");
  } else if (m.status === "postponed") {
    parts.push("Rinviata");
  } else {
    parts.push(m.time || "Data da definire");
  }
  return parts.join(" · ");
}

export function MatchesManager({ seasonName, matches, opponents, venues, timeChips }: Props) {
  const [openId, setOpenId] = useState<number | "new" | null>(null);
  const editorProps = { timeChips, onClose: () => setOpenId(null) };
  // Giocate: dalla più recente.
  const played = matches.filter((m) => m.status === "finished").reverse();
  const toPlay = matches.filter((m) => m.status !== "finished");

  return (
    <>
      <PageHeader
        kicker={`Stagione ${seasonName}`}
        title="Partite"
        description="Le modifiche sono visibili subito su Home e Calendario."
        action={
          <button type="button" onClick={() => setOpenId("new")} className={BTN_PRIMARY}>
            + Nuova partita
          </button>
        }
      />

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

        {/* Prima quelle da giocare (anche rinviate e in corso), poi quelle giocate (dalla più recente), smorzate e col risultato. */}
        {[
          { title: "Da giocare", list: toPlay },
          { title: "Giocate", list: played },
        ].map(
          (g) =>
            g.list.length > 0 && (
              <section key={g.title} aria-label={g.title} className="flex flex-col gap-2.5">
                <h2 className="mt-2 font-display text-sm font-semibold tracking-[.14em] text-muted uppercase">
                  {g.title} · {g.list.length}
                </h2>
                {g.list.map((m) => (
                  <MatchRow key={m.id} match={m} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)}>
                    <MatchEditor key={m.id} {...editorProps} match={m} onDuplicated={setOpenId} />
                  </MatchRow>
                ))}
              </section>
            ),
        )}

        {matches.length === 0 && openId !== "new" && (
          <p className="text-base text-muted">Nessuna partita in calendario. Aggiungi la prima con “+ Nuova partita”.</p>
        )}
      </div>
    </>
  );
}

/** Una partita: giocata → sfondo più scuro, testi smorzati e risultato (V/P) al posto del mese. */
function MatchRow({ match: m, open, onToggle, children }: { match: AdminMatch; open: boolean; onToggle: () => void; children: ReactNode }) {
  const played = m.status === "finished";
  const score = played ? matchScore(m.sets) : null;
  return (
    <article className={`overflow-hidden rounded-card border ${played ? "bg-surface-2" : "bg-surface"} ${open ? "border-gold" : played ? "border-line-soft" : "border-line"}`}>
      {/* Telefono: titolo su tutta la larghezza accanto alla data (a 320px la colonna è stretta), sotto info e Modifica. Da sm: Modifica a destra. */}
      <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 px-4 py-3.5">
        <div className={`row-span-2 flex h-14 flex-col items-center justify-center rounded-btn ${played ? "border border-line-soft" : "bg-surface-sel"}`}>
          <span className={`font-display text-2xl leading-none font-extrabold ${played ? "text-muted" : ""}`}>{m.box?.day ?? "?"}</span>
          {score ? (
            <span
              className={`mt-1 rounded-badge px-1 font-display text-xs font-bold tracking-[.04em] text-bg tabular-nums ${score.won ? "bg-green" : "bg-red"}`}
            >
              {score.won ? "V" : "P"} {score.us}–{score.them}
            </span>
          ) : (
            <span className="font-display text-xs font-semibold tracking-[.12em] text-muted uppercase">{m.box?.month ?? "data"}</span>
          )}
        </div>
        {/* Su più righe invece che troncato: su telefono il nome avversario è l'informazione chiave. */}
        <span className={`col-span-2 line-clamp-2 font-display sm:col-span-1 text-[19px] leading-[1.05] font-bold uppercase ${played ? "text-ink-2" : ""}`}>
          <MatchTitle home={m.home ? TEAM_NAME : m.opponent} away={m.home ? m.opponent : TEAM_NAME} usHome={m.home} />
        </span>
        <span className="min-w-0 text-[13px] text-muted">
          {played && m.box && `${m.box.day} ${m.box.month} · `}
          {infoLine(m)}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-h-11 cursor-pointer rounded-seg sm:col-start-3 sm:row-span-2 sm:row-start-1 border border-line-strong px-3.5 font-display text-[15px] font-semibold tracking-[.08em] text-ink uppercase hover:border-gold hover:text-gold"
        >
          {open ? "Chiudi" : "Modifica"}
        </button>
      </div>
      {open && children}
    </article>
  );
}
