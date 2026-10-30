import Link from "next/link";
import { Countdown } from "@/components/public/countdown";
import { PublicShell } from "@/components/public/public-shell";
import { Kicker } from "@/components/ui/kicker";
import { Logo } from "@/components/ui/logo";
import { getCurrentSeason, getSeasonMatches, getStandings, getUsTeam } from "@/lib/data";
import { formatDayMonth, formatLongDate, formatTime } from "@/lib/format";
import { PHASE_LABEL, findLastResult, findNextMatch, matchScore, matchSides } from "@/lib/matches";
import type { MatchWithDetails, Team } from "@/lib/types";

// "Prossima partita" dipende dalla data: rigenera la pagina periodicamente.
export const revalidate = 300;

/** Nome squadra nella card "Prossima partita": CUSBros sempre in oro. */
function NextTeam({ team, alignRight = false }: { team: Team; alignRight?: boolean }) {
  return (
    <span
      className={`font-display text-[clamp(26px,6vw,56px)] leading-[.95] font-bold uppercase ${team.isUs ? "text-gold" : ""} ${alignRight ? "text-right" : ""}`}
    >
      {team.name}
    </span>
  );
}

function NextMatchCard({ match, us }: { match: MatchWithDetails; us: Team }) {
  const [homeTeam, awayTeam] = matchSides(match, us);

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-linear-to-b from-[#151412] to-surface-2">
      <div className="h-1 bg-gold" />
      <div className="flex flex-col gap-[clamp(24px,4vw,36px)] p-[clamp(22px,5vw,44px)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Kicker>Prossima partita</Kicker>
          <span className="font-display text-sm font-semibold tracking-[.12em] whitespace-nowrap text-muted uppercase">
            {match.friendly ? "Amichevole" : `${PHASE_LABEL[match.phase]} · ${match.round}ª giornata`} · {match.home ? "Casa" : "Trasferta"}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[clamp(10px,3vw,32px)]">
          <NextTeam team={homeTeam} />
          <span className="font-display text-[clamp(16px,2.5vw,22px)] font-semibold tracking-[.1em] text-faint">VS</span>
          <NextTeam team={awayTeam} alignRight />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-base text-ink-2">
          <span>
            {formatLongDate(match.startsAt)} · {formatTime(match.startsAt)}
          </span>
          <span className="text-muted">{match.venue}</span>
        </div>
        <Countdown target={match.startsAt.toISOString()} />
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [season, us] = await Promise.all([getCurrentSeason(), getUsTeam()]);
  const [matches, standings] = await Promise.all([getSeasonMatches(season.id), getStandings(season.id)]);
  const next = findNextMatch(matches);
  const last = findLastResult(matches);
  const lastScore = last && matchScore(last.sets);

  return (
    <PublicShell width="wide" navLinks={[{ href: "/calendario", label: "Calendario" }, { href: "/statistiche", label: "Statistiche" }]} watermark>
      <main className="page-enter relative z-1 mx-auto flex max-w-[1200px] flex-col gap-[clamp(48px,8vw,88px)] px-gutter pt-[clamp(24px,6vw,64px)] pb-18">
        <section className="flex flex-wrap items-center gap-[clamp(24px,5vw,56px)]">
          <Logo
            alt="Logo CUSBros Volleyball Team"
            priority
            sizes="260px"
            className="block h-auto w-[clamp(140px,30vw,260px)] drop-shadow-[0_12px_40px_rgba(212,174,98,0.18)]"
          />
          <div className="flex min-w-0 flex-col gap-3.5">
            <span className="font-display text-[15px] font-semibold tracking-[.32em] text-gold uppercase">
              Volleyball Team · CUSB
            </span>
            <h1 className="font-display text-[clamp(76px,18vw,200px)] leading-[.85] font-extrabold tracking-[-0.01em] uppercase">
              CUS<span className="text-gold">Bros</span>
            </h1>
            <span className="text-base text-muted">Stagione {season.name}</span>
          </div>
        </section>

        {next && <NextMatchCard match={next} us={us} />}

        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-5">
          {last && lastScore && (
            <div className="flex flex-col gap-4.5 rounded-panel border border-line bg-surface p-[clamp(22px,4vw,32px)]">
              <Kicker>Ultimo risultato</Kicker>
              <div className="flex flex-wrap items-center gap-5">
                <span className="font-display text-[clamp(56px,12vw,76px)] leading-[.9] font-extrabold tabular-nums">
                  {lastScore.us}
                  <span className="text-faint">–</span>
                  {lastScore.them}
                </span>
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-[22px] leading-[1.05] font-bold uppercase">
                    vs {last.opponent.name}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <span
                      className={`rounded-badge px-2 py-0.5 font-display text-[13px] font-bold tracking-[.1em] ${lastScore.won ? "bg-gold text-bg" : "border border-line bg-chip text-muted"}`}
                    >
                      {lastScore.won ? "V" : "P"}
                    </span>
                    {last.friendly ? "Amichevole · " : ""}
                    {formatDayMonth(last.startsAt)} · {last.home ? "In casa" : "In trasferta"}
                  </span>
                </div>
              </div>
              {last.forfeit ? (
                <span className="text-sm text-muted">Risultato a tavolino</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {last.sets.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-chip border border-line bg-chip px-3.5 py-1.5 font-display text-[17px] font-semibold tabular-nums"
                    >
                      {s.us}–{s.them}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3.5 rounded-panel border border-line bg-surface p-[clamp(22px,4vw,32px)]">
            <div className="flex items-center justify-between gap-3">
              <Kicker>Classifica</Kicker>
              <Link href="/calendario#classifica" className="-my-3 inline-flex min-h-11 items-center text-sm font-semibold">
                Completa →
              </Link>
            </div>
            <ol className="flex flex-col">
              {standings.slice(0, 5).map((row, i) => (
                <li
                  key={row.id}
                  className={`grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-btn px-3 py-2.75 ${row.team.isUs ? "bg-gold font-bold text-bg" : "text-ink"}`}
                >
                  <span className="font-display text-[17px] font-semibold tabular-nums opacity-70">{i + 1}</span>
                  <span className="truncate text-[15px]">{row.team.name}</span>
                  <span className="font-display text-xl font-bold tabular-nums">{row.points}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Link
          href="/calendario"
          className="inline-flex min-h-13 items-center gap-2.5 self-start rounded-btn bg-gold px-7 py-3.5 font-display text-lg font-bold tracking-[.12em] whitespace-nowrap text-bg uppercase hover:bg-gold-hover hover:text-bg active:bg-gold-active"
        >
          Calendario e risultati →
        </Link>
      </main>
    </PublicShell>
  );
}
