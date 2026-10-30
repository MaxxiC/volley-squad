"use client";

// Pagina Statistiche: filtro (stagione o una partita), numeri della squadra e tabella dei giocatori
// ordinabile. I numeri di ogni partita arrivano già calcolati dal server; qui si sommano e si ordinano.
import Link from "next/link";
import { useState } from "react";
import { TEAM_NAME } from "@/lib/club";
import { ROLE_LABEL, shortName, type PlayerRole } from "@/lib/players";
import { STAT_LABEL, efficiency, efficiencyTone, formatPct, type Counts, type StatSkill } from "@/lib/stats";
import { byKind, sumMatches, type MatchKind, type MatchStat, type PlayerTotals, type Split } from "@/lib/stats-season";
import { MatchKindFilter } from "./match-kind-filter";

type Player = { id: number; number: number; firstName: string; lastName: string; role: PlayerRole };

const H2 = "font-display text-[clamp(30px,6vw,44px)] leading-[.95] font-extrabold uppercase";
const TONE = { gold: "text-gold", red: "text-red", ink: "text-ink" } as const;

/** Azioni riuscite per fondamentale (il numeratore mostrato accanto alla %). */
const GOOD: Record<StatSkill, string[]> = {
  attack: ["kill"],
  reception: ["perfect", "good"],
  serve: ["ace"],
  block: ["point"],
  set: ["good"],
};
const SKILL_COLUMNS: StatSkill[] = ["attack", "reception", "serve", "block", "set"];

const total = (c: Counts, skill: StatSkill) => Object.values(c[skill]).reduce((a, b) => a + b, 0);
const good = (c: Counts, skill: StatSkill) => GOOD[skill].reduce((a, k) => a + (c[skill][k] ?? 0), 0);

type SortKey = "points" | "errors" | "matches" | "sets" | "rallies" | StatSkill;

/** Azioni minime per stare in testa ordinando un fondamentale: con 2 su 2 non si supera chi ha 10 su 12. */
const MIN_ACTIONS = 3;

/**
 * Valore per ordinare (più alto = prima); nei fondamentali la %, a parità il numero di azioni,
 * e chi ha meno di MIN_ACTIONS azioni dopo gli altri.
 */
function sortValue(p: PlayerTotals, key: SortKey): number {
  switch (key) {
    case "points":
      return p.points;
    case "errors":
      return p.errors;
    case "matches":
      return p.matches;
    case "sets":
      return p.time.sets;
    case "rallies":
      return p.time.rallies;
    default: {
      const eff = efficiency(key, p.counts);
      const n = total(p.counts, key);
      if (eff === null) return -Infinity;
      return (n >= MIN_ACTIONS ? 1e6 : 0) + (eff + 100) * 1000 + n;
    }
  }
}

export function StatsBoard({ matches: all, players }: { matches: MatchStat[]; players: Player[] }) {
  const [kind, setKind] = useState<MatchKind>("ufficiali");
  const [picked, setFilter] = useState<number | "all">("all");
  const [sort, setSort] = useState<SortKey>("points");

  // Di base solo le partite ufficiali; il filtro compare se c'è almeno un'amichevole.
  const hasFriendlies = all.some((m) => m.friendly);
  const matches = byKind(all, kind);
  const filter = picked !== "all" && matches.some((m) => m.id === picked) ? picked : "all";
  const chosen = filter === "all" ? matches : matches.filter((m) => m.id === filter);
  const sum = sumMatches(chosen);
  const playerOf = (id: number) => players.find((p) => p.id === id);
  const rows = [...sum.players].sort((a, b) => sortValue(b, sort) - sortValue(a, sort));

  const filterBar = hasFriendlies && <MatchKindFilter value={kind} onChange={setKind} />;

  if (!matches.length) {
    return (
      <>
        {filterBar}
        <p className="rounded-card border border-line bg-surface px-4 py-3.5 text-[15px] text-ink-2">
          {all.length
            ? "Nessuna partita registrata di questo tipo."
            : "Le statistiche arrivano dalle partite registrate azione per azione: appena ce n'è una conclusa, le trovi qui."}
        </p>
      </>
    );
  }

  return (
    <>
      {filterBar}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-[.14em] text-muted uppercase">Partite</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="min-h-12 w-full rounded-btn border border-line-strong bg-surface px-3 text-base text-ink"
        >
          <option value="all">
            {kind === "amichevoli" ? "Tutte le amichevoli" : "Tutta la stagione"} · {matches.length} {matches.length === 1 ? "partita" : "partite"}
          </option>
          {[...matches].reverse().map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · {m.result}
            </option>
          ))}
        </select>
      </label>

      <TeamSection sum={sum} played={chosen.length} />

      <section className="flex flex-col gap-4">
        <h2 className={H2}>Giocatori</h2>
        <p className="text-sm text-muted">
          Tocca un nome per la sua scheda, una colonna per ordinare. Nei fondamentali: efficienza e azioni riuscite su quelle fatte (ordinando, prima chi ne ha almeno {MIN_ACTIONS}). Punti giocati = scambi in campo.
        </p>
        <div className="overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="sticky left-0 z-1 bg-surface px-3 py-2 text-xs font-semibold tracking-[.1em] text-muted uppercase">
                  Giocatore
                </th>
                <SortHeader label="Punti" k="points" sort={sort} onSort={setSort} />
                <SortHeader label="Errori" k="errors" sort={sort} onSort={setSort} />
                <SortHeader label="Partite" k="matches" sort={sort} onSort={setSort} />
                <SortHeader label="Set" k="sets" sort={sort} onSort={setSort} />
                <SortHeader label="Punti giocati" k="rallies" sort={sort} onSort={setSort} />
                {SKILL_COLUMNS.map((s) => (
                  <SortHeader key={s} label={STAT_LABEL[s]} k={s} sort={sort} onSort={setSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const info = playerOf(p.playerId);
                const role = p.roles[0]?.role ?? info?.role;
                return (
                  <tr key={p.playerId} className="border-b border-line-soft last:border-0">
                    <th scope="row" className="sticky left-0 z-1 bg-surface p-0 text-left font-normal">
                      <Link href={`/statistiche/${p.playerId}`} className="flex min-h-11 items-center gap-2 px-3 py-2.5 text-ink hover:text-gold">
                        <span className="w-7 font-display text-xl font-extrabold text-gold">{info?.number ?? "?"}</span>
                        <span className="flex flex-col">
                          <span className="max-w-[112px] truncate text-[15px] font-semibold underline decoration-line-strong underline-offset-4">
                            {info ? shortName(info) : "—"}
                          </span>
                          {role && <span className="text-xs text-faint">{ROLE_LABEL[role]}</span>}
                        </span>
                      </Link>
                    </th>
                    <NumCell value={p.points} strong />
                    <NumCell value={p.errors} />
                    <NumCell value={p.matches} />
                    <NumCell value={p.time.sets} sub={p.time.sets ? `${p.time.fullSets} interi` : undefined} />
                    <NumCell value={p.time.rallies} />
                    {SKILL_COLUMNS.map((s) => (
                      <SkillCell key={s} counts={p.counts} skill={s} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SortHeader({ label, k, sort, onSort }: { label: string; k: SortKey; sort: SortKey; onSort: (k: SortKey) => void }) {
  const active = sort === k;
  return (
    <th scope="col" aria-sort={active ? "descending" : "none"} className="p-0">
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`min-h-11 w-full cursor-pointer px-3 py-2 text-left text-xs font-semibold tracking-[.1em] whitespace-nowrap uppercase ${active ? "text-gold" : "text-muted"}`}
      >
        {label}
        {active ? " ↓" : ""}
      </button>
    </th>
  );
}

function NumCell({ value, sub, strong = false }: { value: number; sub?: string; strong?: boolean }) {
  return (
    <td className="px-3 py-2.5 align-middle">
      <span className="flex flex-col">
        <span className={`font-display text-xl font-bold ${strong ? "text-gold" : value ? "text-ink" : "text-faint"}`}>{value}</span>
        {sub && <span className="text-xs whitespace-nowrap text-faint">{sub}</span>}
      </span>
    </td>
  );
}

function SkillCell({ counts, skill }: { counts: Counts; skill: StatSkill }) {
  const n = total(counts, skill);
  if (!n) {
    return <td className="px-3 py-2.5 font-display text-xl text-faint">—</td>;
  }
  const eff = efficiency(skill, counts);
  return (
    <td className="px-3 py-2.5 align-middle">
      <span className="flex flex-col">
        <span className={`font-display text-xl font-bold whitespace-nowrap ${TONE[efficiencyTone(eff)]}`}>{formatPct(eff)}</span>
        <span className="text-xs whitespace-nowrap text-faint">
          {good(counts, skill)}/{n}
        </span>
      </span>
    </td>
  );
}

function TeamSection({ sum, played }: { sum: ReturnType<typeof sumMatches>; played: number }) {
  // Punti veri dai parziali; sotto quanti hanno l'azione (gli altri sono stati corretti a mano).
  const scored = sum.total.us;
  const given = sum.total.them;
  const manual = (list: Split[]) => list.find((s) => s.key === "manual")?.value ?? 0;
  const recorded = (n: number, list: Split[]) => (manual(list) ? `${n - manual(list)} con l'azione` : undefined);
  const tiles = [
    { label: played === 1 ? "Partita" : "Partite", value: played, sub: `${sum.won} vinte · ${played - sum.won} perse` },
    { label: "Punti fatti", value: scored, gold: true, sub: recorded(scored, sum.scored) },
    { label: "Punti subiti", value: given, sub: recorded(given, sum.given) },
  ];
  return (
    <section className="flex flex-col gap-4">
      <h2 className={H2}>{TEAM_NAME}</h2>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="flex min-w-0 flex-col gap-1 rounded-tile border border-line bg-surface px-3 py-3">
            <span className="text-xs font-semibold tracking-[.1em] break-words text-muted uppercase">{t.label}</span>
            <span className={`font-display text-[clamp(28px,8vw,40px)] leading-none font-extrabold tabular-nums ${t.gold ? "text-gold" : ""}`}>{t.value}</span>
            {t.sub && <span className="text-xs text-faint">{t.sub}</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
        <SplitCard title="Come abbiamo fatto punto" rows={sum.scored} total={scored} tone="bg-gold" nested={{ key: "opp_error", rows: sum.oppErrors }} />
        <SplitCard title="Come hanno fatto punto loro" rows={sum.given} total={given} tone="bg-red" />
      </div>
    </section>
  );
}

function SplitCard({
  title,
  rows,
  total,
  tone,
  nested,
}: {
  title: string;
  rows: Split[];
  total: number;
  tone: string;
  /** Dettaglio di una voce (es. errori avversari per tipo), sotto di essa. */
  nested?: { key: string; rows: Split[] };
}) {
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-4">
      <span className="font-display text-base font-bold tracking-[.12em] uppercase">{title}</span>
      {rows.length === 0 && <span className="text-sm text-faint">Nessun punto registrato.</span>}
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col gap-1.5">
          <SplitRow row={r} total={total} tone={tone} />
          {nested?.key === r.key && nested.rows.length > 0 && (
            <div className="ml-3 flex flex-col gap-1.5 border-l border-line pl-3">
              {nested.rows.map((n) => (
                <SplitRow key={n.key} row={n} total={total} tone="bg-line-strong" small />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SplitRow({ row, total, tone, small = false }: { row: Split; total: number; tone: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className={small ? "text-[13px] text-ink-2" : "text-sm font-semibold text-ink"}>{row.label}</span>
        <span className={`font-display font-bold tabular-nums ${small ? "text-base text-ink-2" : "text-xl"}`}>{row.value}</span>
      </div>
      <div aria-hidden className="h-1.5 rounded-pill bg-line-soft">
        <div className={`h-full rounded-pill ${tone}`} style={{ width: `${total ? (row.value / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
