import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { RefreshPages } from "@/components/public/refresh-pages";
import { StatsBoard } from "@/components/public/stats-board";
import { getCurrentSeason } from "@/lib/data";
import { getSeasonStats } from "@/lib/stats-data";

export const revalidate = 300;

export const metadata: Metadata = { title: "Statistiche" };

export default async function StatistichePage() {
  const season = await getCurrentSeason();
  const { matches, players } = await getSeasonStats(season.id);

  return (
    <PublicShell width="narrow" navLinks={[{ href: "/", label: "Home" }, { href: "/calendario", label: "Calendario" }]}>
      <main className="page-enter relative z-1 mx-auto flex max-w-[1000px] flex-col gap-[clamp(28px,5vw,48px)] px-gutter pt-[clamp(20px,5vw,48px)] pb-18">
        <header className="flex flex-col gap-2">
          <span className="font-display text-[15px] font-semibold tracking-[.14em] text-gold uppercase">{season.name}</span>
          <h1 className="font-display text-[clamp(44px,11vw,88px)] leading-[.9] font-extrabold uppercase">Statistiche</h1>
          <p className="text-[15px] text-ink-2">Dalle partite registrate azione per azione col Live.</p>
          <RefreshPages />
        </header>
        <StatsBoard matches={matches} players={players} />
      </main>
    </PublicShell>
  );
}
