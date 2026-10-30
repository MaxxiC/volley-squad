"use client";

// Statistiche di un giocatore: usate dalla scheda pubblica (/statistiche/[id]) e da Admin Giocatori.
// Filtro per partita o per ruolo, tempo in campo, fondamentali del ruolo in evidenza con tutti gli
// esiti contati, andamento e partita per partita. I numeri di ogni partita arrivano dal server.
import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL, type PlayerRole } from "@/lib/players";
import {
  SKILL_OUTCOMES,
  STAT_LABEL,
  TREND_MATCHES,
  efficiency,
  efficiencyTone,
  formatPct,
  skillGroups,
  skillTotal as total,
  type Counts,
  type StatSkill,
} from "@/lib/stats";
import { MatchKindFilter } from "@/components/public/match-kind-filter";
import { byKind, sumPlayer, type MatchKind, type PlayerMatchRow } from "@/lib/stats-season";
import { TrendChart } from "./trend-chart";

const TONE = { gold: "text-gold", red: "text-red", ink: "text-ink" } as const;
const KICKER = "font-display text-sm font-bold tracking-[.2em] text-gold uppercase";
const SEG_GROUP = "flex max-w-full flex-wrap gap-1 self-start rounded-btn border border-line p-0.5";
const segButton = (on: boolean) =>
  `min-h-11 cursor-pointer rounded-chip px-3 font-display text-sm font-bold tracking-[.04em] whitespace-nowrap uppercase ${on ? "bg-gold text-bg" : "text-muted"}`;

type Props = {
  rows: PlayerMatchRow[];
  /** Ruolo in anagrafica: decide i fondamentali in evidenza finché non ci sono partite. */
  role: PlayerRole;
};

export function PlayerStats({ rows: all, role }: Props) {
  const [kind, setKind] = useState<MatchKind>("ufficiali");
  const [picked, setMatch] = useState<number | "all">("all");
  const [view, setView] = useState<"all" | PlayerRole>("all");

  // Di base solo le partite ufficiali; il filtro compare se ha giocato almeno un'amichevole.
  const hasFriendlies = all.some((r) => r.friendly);
  const rows = byKind(all, kind);
  const match = picked !== "all" && rows.some((r) => r.id === picked) ? picked : "all";
  const filterBar = hasFriendlies && <MatchKindFilter value={kind} onChange={setKind} />;

  if (!rows.length) {
    return (
      <div className="flex flex-col gap-3">
        {filterBar}
        <p className="rounded-tile border border-dashed border-line p-3.5 text-sm text-muted">
          {all.length
            ? "Nessuna partita di questo tipo."
            : "Le statistiche compaiono qui quando ci sono partite concluse registrate con il Live."}
        </p>
      </div>
    );
  }

  const roles = sumPlayer(0, rows.map((r) => r.stat)).roles;
  const byRole = view === "all" ? rows : rows.filter((r) => r.stat.role === view);
  const scope = match === "all" ? byRole : rows.filter((r) => r.id === match);
  const totals = sumPlayer(0, scope.map((r) => r.stat));
  const mvps = scope.filter((r) => r.mvp).length;

  // Fondamentali del ruolo (o dei ruoli giocati) in evidenza, poi gli altri con almeno un'azione.
  const focusRoles = match !== "all" ? [scope[0]?.stat.role ?? role] : view !== "all" ? [view] : roles.length ? roles.map((r) => r.role) : [role];
  const { focus, others } = skillGroups(totals.counts, focusRoles);

  const tiles = [
    { label: scope.length === 1 ? "Partita" : "Partite", value: scope.length },
    { label: "Set", value: totals.time.sets, sub: `${totals.time.fullSets} interi` },
    { label: "Punti giocati", value: totals.time.rallies },
    { label: "Punti fatti", value: totals.points, gold: true },
    { label: "Errori", value: totals.errors },
    { label: "Stelline", value: `★ ${totals.stars}`, gold: true, sub: mvps === 1 ? "1 volta MVP" : `${mvps} volte MVP` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        {filterBar}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-[.14em] text-muted uppercase">Partite</span>
          <select
            value={match}
            onChange={(e) => setMatch(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="min-h-12 w-full rounded-btn border border-line-strong bg-surface px-3 text-base text-ink"
          >
            <option value="all">
              {kind === "amichevoli" ? "Tutte le amichevoli" : "Tutta la stagione"} · {rows.length} {rows.length === 1 ? "partita" : "partite"}
            </option>
            {[...rows].reverse().map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} · {r.result}
              </option>
            ))}
          </select>
        </label>
        {match === "all" && roles.length > 1 && (
          <div role="group" aria-label="Ruolo" className={SEG_GROUP}>
            {[{ key: "all" as const, label: "Tutti i ruoli" }, ...roles.map((r) => ({ key: r.role, label: `${ROLE_LABEL[r.role]} · ${r.matches}` }))].map(
              (o) => (
                <button key={o.key} type="button" aria-pressed={view === o.key} onClick={() => setView(o.key)} className={segButton(view === o.key)}>
                  {o.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-px overflow-hidden rounded-tile border border-line bg-line">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1 bg-surface-2 p-3">
            <span className={`font-display text-[28px] leading-none font-extrabold tabular-nums ${t.gold ? "text-gold" : ""}`}>{t.value}</span>
            <span className="text-xs font-semibold tracking-[.1em] text-muted uppercase">{t.label}</span>
            {t.sub && <span className="text-xs text-faint">{t.sub}</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={KICKER}>
          {focusRoles.length === 1 ? `Fondamentali da ${ROLE_LABEL[focusRoles[0]].toLowerCase()}` : "Fondamentali dei ruoli giocati"}
        </span>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5">
          {focus.map((s) => (
            <SkillCard key={s} skill={s} counts={totals.counts} />
          ))}
        </div>
        {others.length > 0 && (
          <>
            <span className="pt-1 text-xs font-semibold tracking-[.14em] text-muted uppercase">Fuori ruolo</span>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5">
              {others.map((s) => (
                <SkillCard key={s} skill={s} counts={totals.counts} small />
              ))}
            </div>
          </>
        )}
        <p className="text-[13px] text-faint">
          Efficienza con le formule del Live; sotto ogni esito contato. In modalità Semplice si segnano punti, errori, ricezioni e
          attacchi giocati; alzate, tocchi a muro e battute in campo arrivano dalla modalità Avanzato.
        </p>
      </div>

      {match === "all" && <Trend rows={byRole} skills={[...focus, ...others]} />}

      {match === "all" && <MatchList rows={byRole} />}
    </div>
  );
}

/** Card di un fondamentale: efficienza, azioni e ogni esito con il suo numero. */
function SkillCard({ skill, counts, small = false }: { skill: StatSkill; counts: Counts; small?: boolean }) {
  const n = total(counts, skill);
  const eff = efficiency(skill, counts);
  return (
    <div className={`flex flex-col gap-2.5 rounded-tile border p-3.5 ${small ? "border-line" : "border-line-strong bg-surface-2"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold tracking-[.08em] text-muted uppercase">{STAT_LABEL[skill]}</span>
        <span className="text-[13px] text-faint">{n === 1 ? "1 azione" : `${n} azioni`}</span>
      </div>
      <span className={`font-display leading-none font-extrabold tabular-nums ${small ? "text-[28px]" : "text-[38px]"} ${TONE[efficiencyTone(eff)]}`}>
        {formatPct(eff)}
      </span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-1.5">
        {SKILL_OUTCOMES[skill].map(([key, label]) => (
          <div key={key} className="flex flex-col rounded-chip bg-surface px-2 py-1.5">
            <span className="font-display text-lg leading-none font-bold tabular-nums">{counts[skill][key] ?? 0}</span>
            <span className="text-[11px] text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Andamento delle ultime partite per il fondamentale scelto. */
function Trend({ rows, skills: order }: { rows: PlayerMatchRow[]; skills: StatSkill[] }) {
  const skills = order.filter((k) => rows.some((r) => total(r.stat.counts, k) > 0));
  const [chosen, setChosen] = useState<StatSkill | null>(null);
  const skill = chosen && skills.includes(chosen) ? chosen : skills[0];
  const points = skill
    ? rows
        .flatMap((r) => {
          const value = efficiency(skill, r.stat.counts);
          return value === null ? [] : [{ label: r.label, title: r.title, value, total: total(r.stat.counts, skill) }];
        })
        .slice(-TREND_MATCHES)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className={KICKER}>Andamento · ultime {TREND_MATCHES} partite</span>
        {skills.length > 1 && (
          <div role="group" aria-label="Fondamentale" className="flex max-w-full gap-1 overflow-x-auto rounded-btn border border-line p-0.5">
            {skills.map((k) => (
              <button key={k} type="button" aria-pressed={k === skill} onClick={() => setChosen(k)} className={segButton(k === skill)}>
                {STAT_LABEL[k]}
              </button>
            ))}
          </div>
        )}
      </div>
      {skill && points.length >= 2 ? (
        <TrendChart key={skill} points={points} skillLabel={STAT_LABEL[skill]} />
      ) : (
        <p className="rounded-tile border border-dashed border-line p-3.5 text-sm text-muted">
          L&apos;andamento compare da 2 partite con azioni{skill ? ` di ${STAT_LABEL[skill].toLowerCase()}` : ""}.
        </p>
      )}
    </div>
  );
}

/** Partita per partita, dalla più recente: tocca per il riepilogo della partita. */
function MatchList({ rows }: { rows: PlayerMatchRow[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className={KICKER}>Partita per partita</span>
      <ul className="flex flex-col gap-1.5">
        {[...rows].reverse().map((r) => (
          <li key={r.id}>
            <Link
              href={`/partite/${r.id}`}
              className="flex min-h-15 flex-col gap-1 rounded-tile border border-line bg-surface px-3.5 py-2.5 text-ink hover:border-gold-line hover:text-ink"
            >
              <span className="flex items-center gap-2">
                <span className="mr-auto min-w-0 truncate text-[15px] font-semibold">{r.title}</span>
                {r.mvp && <span className="rounded-badge bg-gold px-1.5 py-0.5 font-display text-xs font-bold tracking-[.1em] text-bg uppercase">MVP</span>}
                <span className={`shrink-0 font-display text-base font-bold whitespace-nowrap tabular-nums ${r.won ? "text-gold" : "text-muted"}`}>{r.result}</span>
              </span>
              <span className="text-[13px] text-muted">
                {[
                  ROLE_LABEL[r.stat.role],
                  r.stat.time.rallies ? `${r.stat.time.rallies} punti giocati` : "non è entrato",
                  `${r.stat.points} punti`,
                  `${r.stat.errors} errori`,
                  r.stat.stars ? `★ ${r.stat.stars}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
