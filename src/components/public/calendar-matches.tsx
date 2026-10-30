"use client";

import Link from "next/link";
import { useState } from "react";
import { MatchTitle } from "@/components/ui/match-title";
import { SEGMENTED_FILL, segmentClass } from "@/components/ui/segmented";

/** Dati di una card partita già pronti per la UI (calcolati lato server). */
export type MatchCardData = {
  id: number;
  /** "Andata 2ª", "Amichevole" */
  roundLabel: string;
  friendly: boolean;
  dateLabel: string;
  home: boolean;
  homeName: string;
  awayName: string;
  usIsHome: boolean;
  isNext: boolean;
  played: boolean;
  /** Rinviata: data da ridefinire. */
  postponed: boolean;
  /** Risultato assegnato a tavolino: niente parziali da mostrare. */
  forfeit: boolean;
  sets: { id: number; label: string; won: boolean }[];
  score: string;
  won: boolean;
  time: string;
  venue: string;
  day: string;
  month: string;
};

const FILTERS = [
  { key: "tutte", label: "Tutte" },
  { key: "giocate", label: "Giocate" },
  { key: "prossime", label: "Da giocare" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const KINDS = [
  { key: "tutte", label: "Tutte" },
  { key: "campionato", label: "Campionato" },
  { key: "amichevoli", label: "Amichevoli" },
] as const;

type KindKey = (typeof KINDS)[number]["key"];

export function CalendarMatches({ matches }: { matches: MatchCardData[] }) {
  const [filter, setFilter] = useState<FilterKey>("tutte");
  const [kind, setKind] = useState<KindKey>("tutte");
  const hasFriendlies = matches.some((m) => m.friendly);
  const visible = matches.filter(
    (m) =>
      (filter === "tutte" || (filter === "giocate" ? m.played : !m.played)) &&
      (kind === "tutte" || (kind === "amichevoli" ? m.friendly : !m.friendly)),
  );

  return (
    <section className="flex flex-col gap-4.5">
      {/* Campionato / amichevoli: solo quando c'è almeno un'amichevole. */}
      {hasFriendlies && (
        <div role="group" aria-label="Campionato o amichevoli" className={SEGMENTED_FILL}>
          {KINDS.map((k) => (
            <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)} className={segmentClass(kind === k.key, true)}>
              {k.label}
            </button>
          ))}
        </div>
      )}
      <div role="group" aria-label="Filtra partite" className={SEGMENTED_FILL}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={segmentClass(filter === f.key, true)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {visible.length === 0 && <p className="text-[15px] text-muted">Nessuna partita con questi filtri.</p>}
        {visible.map((m) =>
          m.played ? (
            <Link key={m.id} href={`/partite/${m.id}`} className="block text-ink hover:text-ink">
              <MatchCard match={m} />
            </Link>
          ) : (
            <MatchCard key={m.id} match={m} />
          ),
        )}
      </div>
    </section>
  );
}

function MatchCard({ match: m }: { match: MatchCardData }) {
  return (
    <article
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3.5 rounded-card border bg-surface p-[clamp(16px,3.5vw,24px)] ${m.isNext ? "border-gold" : "border-line"}`}
    >
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-sm font-semibold tracking-[.1em] uppercase">
          <span className={m.friendly ? "text-gold" : "text-muted"}>
            {m.roundLabel} · {m.dateLabel}
          </span>
          <span className={m.home ? "text-blue" : "text-muted"}>{m.home ? "Casa" : "Trasferta"}</span>
          {m.isNext && <span className="rounded-badge bg-gold px-2 py-0.5 font-bold text-bg">Prossima</span>}
          {m.postponed && (
            <span className="rounded-badge border border-line-strong px-2 py-0.5 font-bold text-ink-2">Rinviata</span>
          )}
        </div>

        <span className="font-display text-[clamp(20px,4vw,26px)] leading-[1.05] font-bold uppercase">
          <MatchTitle home={m.homeName} away={m.awayName} usHome={m.usIsHome} />
        </span>

        {m.played && m.forfeit ? (
          <span className="text-sm text-muted">Risultato a tavolino</span>
        ) : m.played ? (
          <div className="flex flex-wrap gap-1.5">
            {m.sets.map((s) => (
              <span
                key={s.id}
                className={`rounded-[5px] border px-2.5 py-0.75 font-display text-[15px] font-semibold tabular-nums ${s.won ? "border-gold-line text-gold" : "border-line text-muted"}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted">
            {m.postponed ? "Nuova data da definire" : m.time} · {m.venue}
          </span>
        )}
      </div>

      {m.played ? (
        <div className={`flex flex-col items-end gap-1 ${m.won ? "text-gold" : "text-muted"}`}>
          <span className="font-display text-[clamp(36px,8vw,48px)] leading-[.9] font-extrabold tabular-nums">{m.score}</span>
          <span className="font-display text-[13px] font-bold tracking-[.14em] uppercase">{m.won ? "Vinta" : "Persa"}</span>
        </div>
      ) : (
        <div
          className={`flex size-16 flex-col items-center justify-center rounded-tile border border-line ${m.postponed ? "opacity-45" : ""}`}
        >
          <span className="font-display text-[28px] leading-none font-extrabold">{m.day}</span>
          <span className="font-display text-[13px] font-semibold tracking-[.12em] text-muted uppercase">{m.month}</span>
        </div>
      )}
    </article>
  );
}
