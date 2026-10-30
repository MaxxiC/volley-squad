import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PlayerStats } from "@/components/player-stats/player-stats";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/db";
import { players } from "@/db/schema";
import { getCurrentSeason } from "@/lib/data";
import { ROLE_LABEL, fullName } from "@/lib/players";
import { getSeasonStats } from "@/lib/stats-data";
import { playerRows, sumPlayer } from "@/lib/stats-season";

export const revalidate = 300;

/** Giocatore e le sue partite registrate nella stagione; null se il giocatore non esiste. */
const loadPlayer = cache(async (id: number) => {
  if (!Number.isInteger(id)) return null;
  const player = await db.query.players.findFirst({ where: eq(players.id, id) });
  if (!player) return null;
  const season = await getCurrentSeason();
  const { matches } = await getSeasonStats(season.id);
  return { player, season, rows: playerRows(matches, id) };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await loadPlayer(Number((await params).id));
  return { title: data ? `${fullName(data.player)} · Statistiche` : "Statistiche" };
}

export default async function GiocatorePage({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadPlayer(Number((await params).id));
  if (!data) notFound();
  const { player, season, rows } = data;
  // Ruoli giocati nelle partite, se diversi da quello in anagrafica (es. una banda che fa l'alzatore).
  const played = sumPlayer(player.id, rows.map((r) => r.stat)).roles.filter((r) => r.role !== player.role);
  const roleText = [
    ROLE_LABEL[player.role],
    played.length ? `in partita anche ${played.map((r) => `${ROLE_LABEL[r.role].toLowerCase()} (${r.matches})`).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PublicShell width="narrow" navLinks={[{ href: "/statistiche", label: "← Statistiche" }, { href: "/calendario", label: "Calendario" }]}>
      <main className="page-enter relative z-1 mx-auto flex max-w-[1000px] flex-col gap-[clamp(24px,5vw,40px)] px-gutter pt-[clamp(20px,5vw,48px)] pb-18">
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-1">
          <span className="row-span-3 font-display text-[clamp(72px,18vw,120px)] leading-[.8] font-extrabold text-gold tabular-nums">{player.number}</span>
          <span className="font-display text-[15px] font-semibold tracking-[.14em] text-gold uppercase">{season.name}</span>
          <h1 className="font-display text-[clamp(32px,8vw,60px)] leading-[.95] font-extrabold break-words uppercase">{fullName(player)}</h1>
          <span className="text-[15px] text-ink-2">{roleText}</span>
        </header>
        <PlayerStats rows={rows} role={player.role} />
      </main>
    </PublicShell>
  );
}
