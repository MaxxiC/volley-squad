"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { BTN_PRIMARY } from "@/components/admin/styles";
import { PlayerStats } from "@/components/player-stats/player-stats";
import { GENDER_LABEL, ROLE_LABEL, fullName } from "@/lib/players";
import type { AdminPlayer } from "./player-form";
import { PlayerEditor } from "./player-editor";

type Props = { players: AdminPlayer[]; matchesPlayed: number };

/** Selezione: un giocatore (scheda o modifica) oppure il form di un nuovo giocatore. */
type Selection = { id: number; editing: boolean } | { id: "new" };

export function PlayersManager({ players, matchesPlayed }: Props) {
  const [selection, setSelection] = useState<Selection | null>(players[0] ? { id: players[0].id, editing: false } : null);
  const panelRef = useRef<HTMLElement>(null);
  // Mai ripiegare su un altro giocatore: subito dopo un salvataggio la lista può non essere
  // ancora aggiornata, e una selezione "di riserva" farebbe agire Modifica/Elimina sulla persona sbagliata.
  const selected = selection && selection.id !== "new" ? players.find((p) => p.id === selection.id) : undefined;
  const activeCount = players.filter((p) => p.active).length;

  // Su telefono la scheda sta sotto la lista: dopo la scelta la si porta in vista.
  const select = (next: Selection) => {
    setSelection(next);
    requestAnimationFrame(() => {
      const top = panelRef.current?.getBoundingClientRect().top ?? 0;
      if (top > window.innerHeight * 0.6) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      <PageHeader
        kicker={`Rosa · ${activeCount} giocatori`}
        title="Giocatori"
        action={
          <button type="button" onClick={() => select({ id: "new" })} className={BTN_PRIMARY}>
            + Giocatore
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-5">
        <ul className="flex flex-col gap-1.5">
          {players.map((p) => {
            const isSelected = selected?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => select({ id: p.id, editing: false })}
                  aria-current={isSelected ? "true" : undefined}
                  className={`grid min-h-15 w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-tile border px-3.5 py-2.5 text-left text-ink hover:border-gold-line ${isSelected ? "border-gold bg-surface-sel" : "border-line bg-surface"} ${p.active ? "" : "opacity-55"}`}
                >
                  <span className="font-display text-[28px] leading-none font-extrabold text-gold tabular-nums">{p.number}</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-base font-semibold">{fullName(p)}</span>
                    <span className="text-[13px] text-muted">
                      {ROLE_LABEL[p.role]}
                      {p.active ? "" : " · non attivo"}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5 font-display text-sm font-semibold whitespace-nowrap text-muted">
                    <span className="text-gold">★ {p.stars}</span>
                    <span>
                      {p.presences}/{matchesPlayed} pres.
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section
          ref={panelRef}
          className="flex min-w-0 scroll-mt-32 flex-col gap-6 rounded-panel border border-line bg-surface p-[clamp(18px,4vw,28px)]"
        >
          {selection?.id === "new" ? (
            <PlayerEditor key="new" onDone={(id) => select({ id, editing: false })} onCancel={() => setSelection(null)} />
          ) : selected && selection && "editing" in selection && selection.editing ? (
            <PlayerEditor
              key={selected.id}
              player={selected}
              onDone={(id) => select({ id, editing: false })}
              onCancel={() => setSelection({ id: selected.id, editing: false })}
              onDeleted={() => setSelection(null)}
            />
          ) : selected ? (
            <PlayerCard key={selected.id} player={selected} onEdit={() => setSelection({ id: selected.id, editing: true })} />
          ) : (
            <p className="text-base text-muted">
              {players.length ? "Scegli un giocatore dalla lista." : "Nessun giocatore in rosa. Aggiungi il primo con “+ Giocatore”."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function PlayerCard({ player: p, onEdit }: { player: AdminPlayer; onEdit: () => void }) {
  const cells = [
    { value: p.presences, label: "Presenze" },
    { value: `★ ${p.stars}`, label: "Stelline", gold: true },
    { value: p.mvp, label: "MVP" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-4.5">
        <span className="font-display text-[76px] leading-[.85] font-extrabold text-gold tabular-nums">{p.number}</span>
        <div className="mr-auto flex flex-col gap-1">
          <span className="font-display text-[30px] leading-none font-bold uppercase">{fullName(p)}</span>
          <span className="text-sm text-muted">
            {[ROLE_LABEL[p.role], p.gender && GENDER_LABEL[p.gender], !p.active && "non attivo"].filter(Boolean).join(" · ")}
          </span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 cursor-pointer rounded-seg border border-line-strong px-3.5 font-display text-[15px] font-semibold tracking-[.08em] text-ink uppercase hover:border-gold hover:text-gold"
        >
          Modifica
        </button>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-tile border border-line bg-line">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col gap-1 bg-surface-2 p-3.5">
            <span className={`font-display text-[30px] leading-none font-extrabold tabular-nums ${c.gold ? "text-gold" : ""}`}>
              {c.value}
            </span>
            <span className="text-xs font-semibold tracking-[.1em] text-muted uppercase">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-sm font-bold tracking-[.2em] text-gold uppercase">Statistiche · stagione</span>
          {/* La stessa scheda è pubblica: si può condividere con il giocatore. */}
          <Link href={`/statistiche/${p.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold">
            Scheda pubblica →
          </Link>
        </div>
        <PlayerStats rows={p.rows} role={p.role} />
      </div>
    </>
  );
}
