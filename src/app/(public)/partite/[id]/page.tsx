import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/db";
import { matchPlayers, matchSets, matches, players } from "@/db/schema";
import { TEAM_NAME } from "@/lib/club";
import { getUsTeam } from "@/lib/data";
import { formatLongDate, formatTime } from "@/lib/format";
import { loadLiveLog } from "@/lib/live/db";
import { activeEvents } from "@/lib/live/state";
import { bestPlayers, comparison, playerLine, pointSplit, type SplitKey } from "@/lib/match-report";
import { matchScore, matchTitle, roundLabel } from "@/lib/matches";
import { ROLE_LABEL, fullName } from "@/lib/players";
import { formatPct } from "@/lib/stats";

export const revalidate = 300;

const H2 = "font-display text-[clamp(30px,6vw,44px)] leading-[.95] font-extrabold uppercase";

/** Colore di ogni tipo di punto (README → Come abbiamo fatto punto). */
const SPLIT_COLOR: Record<SplitKey, string> = {
  attack: "bg-gold",
  block: "bg-gold-hover",
  ace: "bg-blue",
  opp_error: "bg-faint",
  other: "bg-line-strong",
};

/** Partita conclusa con avversario, parziali, MVP e presenti; null se non c'è o non è conclusa. */
const loadMatch = cache(async (id: number) => {
  if (!Number.isInteger(id)) return null;
  const match = await db.query.matches.findFirst({ where: eq(matches.id, id), with: { opponent: true } });
  if (!match || match.status !== "finished") return null;
  const [sets, present, log] = await Promise.all([
    db.select().from(matchSets).where(eq(matchSets.matchId, id)).orderBy(asc(matchSets.n)),
    db
      .select({ id: players.id, number: players.number, firstName: players.firstName, lastName: players.lastName, role: matchPlayers.role })
      .from(matchPlayers)
      .innerJoin(players, eq(players.id, matchPlayers.playerId))
      .where(eq(matchPlayers.matchId, id)),
    loadLiveLog(id),
  ]);
  const mvp = match.mvpPlayerId ? await db.query.players.findFirst({ where: eq(players.id, match.mvpPlayerId) }) : null;
  return { match, sets, present, events: activeEvents(log.events), mvp };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await loadMatch(Number((await params).id));
  if (!data) return { title: "Partita" };
  const score = matchScore(data.sets);
  return { title: `${matchTitle(data.match.home, data.match.opponent.name)} · ${score.us}–${score.them}` };
}

export default async function PartitaPage({ params }: { params: Promise<{ id: string }> }) {
  const [data, us] = await Promise.all([loadMatch(Number((await params).id)), getUsTeam()]);
  if (!data) notFound();
  const { match, sets, present, events, mvp } = data;
  const score = matchScore(sets);
  const recorded = events.some((e) => e.kind === "action");
  const playerOf = (id: number) => present.find((p) => p.id === id);

  const meta = [
    match.startsAt && `${formatLongDate(match.startsAt)} · ${formatTime(match.startsAt)}`,
    match.venue,
  ].filter(Boolean);
  // Squadre nell'ordine casa → ospite, come nel calendario.
  const sides = [
    { name: us.name, sets: score.us, isUs: true },
    { name: match.opponent.name, sets: score.them, isUs: false },
  ];
  const [left, right] = match.home ? sides : [sides[1], sides[0]];
  const setsClass = (side: (typeof sides)[number]) => (side.isUs ? "text-gold" : score.won ? "text-faint" : "text-ink");

  return (
    <PublicShell width="narrow" navLink={{ href: "/calendario", label: "← Calendario" }}>
      <main className="page-enter relative z-1 mx-auto flex max-w-[1000px] flex-col gap-[clamp(36px,6vw,56px)] px-gutter pt-[clamp(16px,4vw,40px)] pb-18">
        <section className="flex flex-col gap-5.5">
          <div className="flex flex-wrap gap-x-3.5 gap-y-2 font-display text-[15px] font-semibold tracking-[.14em] uppercase">
            <span className="text-gold">
              {roundLabel(match)}
              {match.number ? ` · n. ${match.number}` : ""}
            </span>
            {meta.length > 0 && <span className="text-muted">{meta.join(" · ")}</span>}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-[clamp(10px,3vw,32px)]">
            {[left, right].map((side, i) => (
              <div key={side.name} className={`flex min-w-0 flex-col gap-1.5 ${i === 1 ? "order-3 items-end text-right" : ""}`}>
                <span className={`font-display text-[clamp(20px,4.5vw,36px)] leading-none font-bold break-words uppercase ${side.isUs ? "text-gold" : ""}`}>
                  {side.name}
                </span>
                <span className={`font-display text-[clamp(88px,24vw,180px)] leading-[.8] font-extrabold tabular-nums ${setsClass(side)}`}>
                  {side.sets}
                </span>
              </div>
            ))}
            <span
              className={`order-2 mb-3 rounded-badge px-2.5 py-1 font-display text-sm font-bold tracking-[.16em] uppercase ${score.won ? "bg-gold text-bg" : "border border-line-strong text-ink-2"}`}
            >
              {score.won ? "Vinta" : "Persa"}
            </span>
          </div>

          {match.forfeit ? (
            <p className="rounded-card border border-line bg-surface px-4 py-3.5 text-[15px] text-ink-2">
              Risultato assegnato a tavolino ({score.us}–{score.them} d&apos;ufficio).
            </p>
          ) : (
            sets.length > 0 && (
              // Righe che si allargano da sole: con 4 o 5 set l'ultima riga si riempie, senza celle vuote.
              <div className="flex flex-wrap gap-px overflow-hidden rounded-card border border-line bg-line">
                {sets.map((s) => (
                  <div key={s.n} className="flex flex-[1_1_84px] flex-col gap-1 bg-surface px-3 py-3.5">
                    <span className="text-xs font-semibold tracking-[.14em] text-muted uppercase">Set {s.n}</span>
                    <span className="font-display text-[clamp(24px,7vw,30px)] leading-none font-bold whitespace-nowrap tabular-nums">
                      <span className={s.us > s.them ? "text-gold" : ""}>{s.us}</span>
                      <span className="text-faint">–</span>
                      <span className={s.them > s.us ? "text-ink" : "text-ink-2"}>{s.them}</span>
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </section>

        {mvp && <MvpCard mvp={mvp} role={playerOf(mvp.id)?.role} line={recorded ? playerLine(events, mvp.id) : null} />}

        {recorded ? (
          <>
            <PointSplit split={pointSplit(events)} />
            <Bests bests={bestPlayers(events)} playerOf={playerOf} />
            <Compare rows={comparison(events, sets)} opponent={match.opponent.name} />
          </>
        ) : (
          !match.forfeit && (
            <p className="text-sm text-muted">
              Le statistiche (come abbiamo fatto punto, i migliori, il confronto) ci sono per le partite registrate azione per azione: per questa c&apos;è solo il risultato.
            </p>
          )
        )}
      </main>
    </PublicShell>
  );
}

function MvpCard({
  mvp,
  role,
  line,
}: {
  mvp: { number: number; firstName: string; lastName: string };
  role: keyof typeof ROLE_LABEL | undefined;
  line: ReturnType<typeof playerLine> | null;
}) {
  const details = [
    role && ROLE_LABEL[role],
    line && line.points > 0 && `${line.points} ${line.points === 1 ? "punto" : "punti"}`,
    line && line.attack !== null && `${formatPct(line.attack)} in attacco`,
    line && line.stars > 0 && `★ ${line.stars}`,
  ].filter(Boolean);
  return (
    <section className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 rounded-panel border border-gold-line bg-linear-to-b from-surface-sel to-surface p-[clamp(20px,4vw,32px)]">
      <span className="font-display text-[clamp(72px,16vw,112px)] leading-[.8] font-extrabold text-gold tabular-nums">{mvp.number}</span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-display text-[15px] font-bold tracking-[.24em] text-gold uppercase">MVP della partita</span>
        <span className="font-display text-[clamp(28px,6vw,40px)] leading-none font-bold break-words uppercase">{fullName(mvp)}</span>
        {details.length > 0 && <span className="text-[15px] text-ink-2">{details.join(" · ")}</span>}
      </div>
    </section>
  );
}

function PointSplit({ split }: { split: ReturnType<typeof pointSplit> }) {
  const total = split.reduce((t, p) => t + p.value, 0);
  return (
    <section className="flex flex-col gap-4">
      <h2 className={H2}>Come abbiamo fatto punto</h2>
      {total > 0 && (
        // Barra decorativa: i numeri sono nelle card qui sotto.
        <div aria-hidden className="flex h-3.5 gap-0.5 overflow-hidden rounded-pill">
          {split.filter((p) => p.value > 0).map((p) => (
            <span key={p.key} className={SPLIT_COLOR[p.key]} style={{ flex: p.value }} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5">
        {split.map((p) => (
          <div key={p.key} className="flex flex-col gap-1.5 rounded-tile border border-line bg-surface px-4 py-3.5">
            <span className="flex items-center gap-2 text-[13px] font-semibold tracking-[.08em] text-muted uppercase">
              <span aria-hidden className={`size-2.5 rounded-full ${SPLIT_COLOR[p.key]}`} />
              {p.label}
            </span>
            <span className="font-display text-4xl leading-none font-extrabold tabular-nums">{p.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Bests({
  bests,
  playerOf,
}: {
  bests: ReturnType<typeof bestPlayers>;
  playerOf: (id: number) => { number: number; firstName: string; lastName: string } | undefined;
}) {
  if (!bests.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className={H2}>I migliori</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-2.5">
        {bests.map((b) => {
          const p = playerOf(b.playerId);
          return (
            <div key={b.category} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1 rounded-card border border-line bg-surface p-4">
              <span className="col-span-2 font-display text-sm font-bold tracking-[.2em] text-gold uppercase">{b.category}</span>
              <span className="font-display text-[44px] leading-none font-extrabold text-gold tabular-nums">{p?.number ?? "?"}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-base font-semibold">{p ? fullName(p) : "—"}</span>
                <span className="text-sm text-muted">{b.value}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Compare({ rows, opponent }: { rows: ReturnType<typeof comparison>; opponent: string }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className={H2}>Squadra a confronto</h2>
      <div className="flex flex-col gap-4.5 rounded-panel border border-line bg-surface p-[clamp(16px,3vw,24px)]">
        <div className="flex justify-between gap-3 font-display text-sm font-bold tracking-[.14em] uppercase">
          <span className="text-gold">{TEAM_NAME}</span>
          <span className="truncate text-right text-muted">{opponent}</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-baseline gap-2">
              <span className="font-display text-[22px] font-bold text-gold tabular-nums">{r.us}</span>
              <span className="text-center text-[13px] font-semibold tracking-[.08em] text-ink-2 uppercase">{r.label}</span>
              <span className="text-right font-display text-[22px] font-bold text-muted tabular-nums">{r.them}</span>
            </div>
            <div aria-hidden className="flex h-1.5 gap-0.5">
              <span className="rounded-pill bg-gold" style={{ flex: r.us || (r.them ? 0 : 1) }} />
              <span className="rounded-pill bg-line-strong" style={{ flex: r.them || (r.us ? 0 : 1) }} />
            </div>
          </div>
        ))}
        <p className="text-[13px] text-faint">
          Dell&apos;avversario si registrano solo i suoi punti e i suoi errori: &quot;conquistati&quot; sono attacchi, muri e ace (per loro i &quot;punto avversario&quot;).
        </p>
      </div>
    </section>
  );
}
