// Lettura della pagina pubblica del comitato su SportAdmin (OFFICIAL_CALENDAR_URL): calendario,
// risultati e classifica di un girone. Tutti i dati sono già nell'HTML (il JavaScript del sito li
// mostra soltanto): si legge dagli attributi data-* e dalle classi ps-*. Solo server.
import { parse, type HTMLElement } from "node-html-parser";

export type OfficialTeam = { officialId: number; name: string };

export type OfficialMatch = {
  officialId: number;
  /** Numero gara (n. 8). */
  number: number;
  phase: "andata" | "ritorno";
  round: number;
  /** Data e ora come sul sito, ora di Roma: "2026-10-21T21:15". */
  startsAt: string;
  homeId: number;
  awayId: number;
  venue: string;
  /** Parziali dal punto di vista della squadra di casa; vuoto se non giocata. */
  sets: { home: number; away: number }[];
};

export type OfficialStanding = { officialId: number; name: string; points: number; played: number; won: number; lost: number };

export type OfficialGroup = { teams: OfficialTeam[]; matches: OfficialMatch[]; standings: OfficialStanding[] };

const int = (v: string | undefined | null) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

/** Id della squadra dall'indirizzo del logo: ".../squadre/2051/logo". */
const idFromLogo = (img: HTMLElement | null) => int(img?.getAttribute("src")?.match(/\/squadre\/(\d+)\/logo/)?.[1]);

/**
 * Girone `group` (es. "CHALLENGE"). Errore leggibile se la pagina non ha la forma attesa: meglio
 * fermarsi che importare dati sbagliati.
 */
export function parseOfficialGroup(html: string, group: string): OfficialGroup {
  const root = parse(html);
  const block = root.querySelectorAll(".ps-camp-blocco").find((b) => b.querySelector(".ps-camp-nome")?.text.trim().toUpperCase() === group.toUpperCase());
  if (!block) throw new Error(`Sul sito ufficiale non c'è il girone ${group}: la pagina potrebbe essere cambiata`);

  const teams = new Map<number, string>();
  const matches: OfficialMatch[] = [];
  for (const li of block.querySelectorAll("li.ps-gara")) {
    const officialId = int(li.getAttribute("data-gara"));
    const number = int(li.getAttribute("data-numero"));
    const homeId = int(li.getAttribute("data-casa"));
    const awayId = int(li.getAttribute("data-ospite"));
    const [phaseN, round] = (li.getAttribute("data-giornata") ?? "").split("-").map(int);
    const startsAt = li.getAttribute("data-ora") ?? "";
    const names = li.querySelectorAll(".ps-gara-nome").map((n) => n.text.trim());
    if (!officialId || !number || !homeId || !awayId || !round || (phaseN !== 1 && phaseN !== 2) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) || names.length !== 2) {
      throw new Error(`Gara non leggibile sul sito ufficiale (${li.text.trim().replace(/\s+/g, " ").slice(0, 60)})`);
    }
    teams.set(homeId, names[0]);
    teams.set(awayId, names[1]);
    const sets = li.querySelectorAll(".ps-gara-set > li").map((set) => {
      const [home, away] = set.querySelectorAll("span").map((s) => int(s.text.trim()));
      if (home === null || away === null || home === undefined || away === undefined) throw new Error(`Parziale non leggibile nella gara n. ${number}`);
      return { home, away };
    });
    matches.push({
      officialId,
      number,
      phase: phaseN === 1 ? "andata" : "ritorno",
      round,
      startsAt,
      homeId,
      awayId,
      venue: li.querySelector(".ps-gara-dove")?.text.trim().replace(/\s+/g, " ") ?? "",
      sets,
    });
  }

  const standings = block.querySelectorAll("table.ps-classifica tbody tr").map((tr) => {
    const cells = tr.querySelectorAll("td").map((td) => td.text.trim());
    const officialId = idFromLogo(tr.querySelector(".ps-col-squadra img"));
    const [points, played, won, lost] = cells.slice(2, 6).map(int);
    if (!officialId || points === null || played === null || won === null || lost === null || cells.length < 6) {
      throw new Error("Classifica del sito ufficiale non leggibile");
    }
    return { officialId, name: cells[1], points, played, won, lost };
  });
  for (const s of standings) if (!teams.has(s.officialId)) teams.set(s.officialId, s.name);

  if (!matches.length) throw new Error(`Nessuna gara del girone ${group} sul sito ufficiale`);
  return { teams: [...teams].map(([officialId, name]) => ({ officialId, name })), matches, standings };
}
