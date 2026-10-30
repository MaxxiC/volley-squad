import type { Metadata } from "next";
import { CalendarMatches, type MatchCardData } from "@/components/public/calendar-matches";
import { PublicShell } from "@/components/public/public-shell";
import { COMPETITION_NAME, OFFICIAL_CALENDAR_URL } from "@/lib/club";
import { getCurrentSeason, getSeasonMatches, getStandings, getUsTeam } from "@/lib/data";
import { dateBox, formatShortDate, formatTime } from "@/lib/format";
import { PHASE_LABEL, findLastResult, findNextMatch, matchScore, matchSides, roundLabel } from "@/lib/matches";
import type { StandingRow } from "@/lib/types";

export const metadata: Metadata = { title: "Calendario" };

export const revalidate = 300;

const STANDINGS_GRID = "grid min-w-[380px] grid-cols-[28px_minmax(120px,1fr)_repeat(5,40px)] gap-2 px-3";

export default async function CalendarioPage() {
  const [season, us] = await Promise.all([getCurrentSeason(), getUsTeam()]);
  const [matches, standings] = await Promise.all([getSeasonMatches(season.id), getStandings(season.id)]);
  const next = findNextMatch(matches);
  // Fase in corso: quella della prossima partita, a fine stagione quella dell'ultima.
  const current = next ?? findLastResult(matches);

  const cards: MatchCardData[] = matches.map((m) => {
    const [homeTeam, awayTeam] = matchSides(m, us);
    const score = matchScore(m.sets);
    return {
      id: m.id,
      roundLabel: roundLabel(m),
      dateLabel: formatShortDate(m.startsAt),
      home: m.home,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
      usIsHome: homeTeam.isUs,
      isNext: m.id === next?.id,
      played: m.status === "finished",
      postponed: m.status === "postponed",
      forfeit: m.forfeit,
      sets: m.sets.map((s) => ({ id: s.id, label: `${s.us}–${s.them}`, won: s.us > s.them })),
      score: `${score.us}–${score.them}`,
      won: score.won,
      time: formatTime(m.startsAt),
      venue: m.venue,
      ...dateBox(m.startsAt),
    };
  });

  return (
    <PublicShell width="narrow" navLinks={[{ href: "/", label: "Home" }, { href: "/statistiche", label: "Statistiche" }]}>
      <main className="page-enter relative z-1 mx-auto flex max-w-[1000px] flex-col gap-[clamp(36px,6vw,60px)] px-gutter pt-[clamp(20px,5vw,48px)] pb-18">
        <header className="flex flex-col gap-3">
          <span className="font-display text-[15px] font-semibold tracking-[.28em] text-gold uppercase">
            Stagione {season.name}
            {current ? ` · ${PHASE_LABEL[current.phase]}` : ""}
          </span>
          <h1 className="font-display text-[clamp(56px,13vw,120px)] leading-[.88] font-extrabold uppercase">Calendario</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-muted">
            <span>{COMPETITION_NAME}</span>
            <a
              href={OFFICIAL_CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold"
            >
              Calendario ufficiale ↗
            </a>
          </p>
        </header>

        <SeasonSummary standings={standings} />

        <CalendarMatches matches={cards} />

        <section id="classifica" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="font-display text-[clamp(36px,7vw,56px)] leading-[.95] font-extrabold uppercase">Classifica</h2>
          <div role="table" aria-label="Classifica" className="overflow-x-auto rounded-panel border border-line bg-surface p-[clamp(8px,2vw,14px)]">
            <div
              role="row"
              className={`${STANDINGS_GRID} py-2.5 font-display text-[13px] font-bold tracking-[.12em] text-muted uppercase`}
            >
              <span role="columnheader">#</span>
              <span role="columnheader">Squadra</span>
              <span role="columnheader" className="text-right">Pt</span>
              <span role="columnheader" className="text-right">G</span>
              <span role="columnheader" className="text-right">V</span>
              <span role="columnheader" className="text-right">P</span>
              <span role="columnheader" className="text-right">Set</span>
            </div>
            {standings.map((row, i) => (
              <div
                key={row.id}
                role="row"
                className={`${STANDINGS_GRID} items-center rounded-btn py-2.75 text-[15px] tabular-nums ${row.team.isUs ? "bg-gold font-bold text-bg" : "text-ink"}`}
              >
                <span role="cell" className="opacity-70">{i + 1}</span>
                <span role="cell" className="truncate">{row.team.name}</span>
                <span role="cell" className="text-right font-display text-[19px] font-bold">{row.points}</span>
                <span role="cell" className="text-right">{row.played}</span>
                <span role="cell" className="text-right">{row.won}</span>
                <span role="cell" className="text-right">{row.lost}</span>
                <span role="cell" className="text-right">{row.setsWon}–{row.setsLost}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

/** 4 celle: posizione, punti, vinte–perse, set vinti–persi di CUSBros. */
function SeasonSummary({ standings }: { standings: StandingRow[] }) {
  const index = standings.findIndex((r) => r.team.isUs);
  if (index === -1) return null;
  const row = standings[index];
  const cells = [
    { value: `${index + 1}ª`, label: "In classifica", gold: true },
    { value: row.points, label: "Punti" },
    { value: `${row.won}–${row.lost}`, label: "Vinte – perse" },
    { value: `${row.setsWon}–${row.setsLost}`, label: "Set vinti – persi" },
  ];

  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-px overflow-hidden rounded-panel border border-line bg-line">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-1.5 bg-surface px-5.5 py-5">
          <span className={`font-display text-[44px] leading-none font-extrabold tabular-nums ${c.gold ? "text-gold" : ""}`}>
            {c.value}
          </span>
          <span className="text-xs font-semibold tracking-[.14em] text-muted uppercase">{c.label}</span>
        </div>
      ))}
    </section>
  );
}
