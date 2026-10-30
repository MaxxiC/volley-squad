// Import dal sito ufficiale: lettura della pagina (parse.ts) e confronto col DB (diff.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { planIsEmpty, planOfficialImport, prettyTeamName, type DbMatch, type DbTeam } from "@/lib/official/diff";
import { parseOfficialGroup } from "@/lib/official/parse";

const html = readFileSync(path.join(process.cwd(), "tests/unit/fixtures/sportadmin-mini.html"), "utf8");
const official = parseOfficialGroup(html, "CHALLENGE");

const TEAMS: DbTeam[] = [
  { id: 1, name: "CUSBros", isUs: true, officialId: null },
  { id: 2, name: "Stordyteam", isUs: false, officialId: null },
];
const match = (o: Partial<DbMatch>): DbMatch => ({
  id: 10,
  number: 3,
  phase: "andata",
  round: 1,
  startsAt: new Date("2026-10-21T19:15:00Z"),
  home: true,
  opponentId: 2,
  venue: "Palestra ITIG CAMPO A — Rimini (RN)",
  status: "finished",
  sets: [
    { us: 25, them: 16 },
    { us: 25, them: 18 },
    { us: 25, them: 18 },
  ],
  recorded: false,
  friendly: false,
  ...o,
});

describe("lettura della pagina ufficiale", () => {
  test("solo il girone scelto: gare, parziali, giornate, palestra, classifica", () => {
    assert.equal(official.matches.length, 3);
    const [ours, other, future] = official.matches;
    assert.deepEqual([ours.number, ours.phase, ours.round, ours.startsAt, ours.homeId, ours.awayId], [3, "andata", 1, "2026-10-21T21:15", 51, 56]);
    assert.deepEqual(ours.sets[0], { home: 25, away: 16 });
    assert.equal(ours.venue, "Palestra ITIG CAMPO A — Rimini (RN)", "spazi ripuliti");
    assert.equal(other.sets.length, 4);
    assert.deepEqual([future.phase, future.round, future.sets.length], ["ritorno", 2, 0]);
    assert.deepEqual(
      official.standings.map((s) => [s.officialId, s.name, s.points, s.played, s.won, s.lost]),
      [
        [51, "CUSBROS", 3, 1, 1, 0],
        [56, "STORDYTEAM", 2, 2, 1, 1],
        [45, "DINAMITE", 1, 1, 0, 1],
      ],
    );
  });

  test("pagina diversa dal previsto: errore chiaro invece di dati sbagliati", () => {
    assert.throws(() => parseOfficialGroup(html, "PLATINUM"), /non c'è il girone PLATINUM/);
    assert.throws(() => parseOfficialGroup(html.replace('data-numero="3"', ""), "CHALLENGE"), /Gara non leggibile/);
  });
});

describe("confronto con il DB", () => {
  test("nostra partita: data e palestra aggiornate, risultato già uguale non cambia", () => {
    const p = planOfficialImport(official, { teams: TEAMS, matches: [match({ startsAt: new Date("2026-10-21T18:00:00Z"), venue: "" })], standings: [] }, "CUSBros");
    const u = p.updates.find((x) => x.matchId === 10)!;
    assert.deepEqual(
      u.changes.map((c) => c.split(":")[0]),
      ["Data", "Palestra"],
    );
    assert.equal(u.values.startsAt?.toISOString(), "2026-10-21T19:15:00.000Z", "21:15 ora di Roma");
    assert.equal(u.result, null);
  });

  test("squadre: riconosciute dal nome (maiuscole a parte) e collegate; quelle nuove si creano", () => {
    const p = planOfficialImport(official, { teams: TEAMS, matches: [match({})], standings: [] }, "CUSBros");
    assert.deepEqual(p.linkTeams, [
      { teamId: 1, officialId: 51 },
      { teamId: 2, officialId: 56 },
    ]);
    assert.deepEqual(p.createTeams, [{ officialId: 45, name: "Dinamite" }]);
    assert.equal(p.creates.length, 1, "la n. 46 con Dinamite non c'è da noi: si crea");
    assert.deepEqual(p.creates[0].values.opponent, { create: 45 });
    assert.equal(p.creates[0].values.home, false);
  });

  test("risultato: si scrive se manca; con il Live non si tocca e si segnala la differenza", () => {
    const scheduled = planOfficialImport(official, { teams: TEAMS, matches: [match({ status: "scheduled", sets: [] })], standings: [] }, "CUSBros");
    assert.deepEqual(
      scheduled.updates[0].result?.map((s) => `${s.us}-${s.them}`),
      ["25-16", "25-18", "25-18"],
    );

    const recordedSets = [
      { us: 25, them: 10 },
      { us: 25, them: 18 },
      { us: 25, them: 18 },
    ];
    const live = planOfficialImport(official, { teams: TEAMS, matches: [match({ recorded: true, sets: recordedSets })], standings: [] }, "CUSBros");
    assert.equal(live.updates.length, 0);
    assert.match(live.warnings[0], /risultato del Live 3–0 \(25-10 25-18 25-18\), sul sito ufficiale 3–0 \(25-16/);
  });

  test("le amichevoli si ignorano: mai scambiate per una partita ufficiale, nessun avviso", () => {
    // Amichevole senza numero gara e con la stessa giornata della partita ufficiale (il caso peggiore).
    const friendly = match({ id: 20, number: null, friendly: true, status: "scheduled", sets: [] });
    const p = planOfficialImport(official, { teams: TEAMS, matches: [friendly], standings: [] }, "CUSBros");
    assert.ok(p.updates.every((u) => u.matchId !== 20));
    assert.ok(p.creates.length > 0, "la partita ufficiale va creata, non presa dall'amichevole");
    assert.ok(p.warnings.every((w) => !w.includes("non c'è sul sito")));
  });

  test("classifica: punti dal sito, set calcolati dai parziali", () => {
    const p = planOfficialImport(official, { teams: TEAMS, matches: [match({})], standings: [] }, "CUSBros");
    const stordy = p.standings.find((s) => "teamId" in s.team && s.team.teamId === 2)!;
    // Stordyteam: 0–3 con noi, 3–1 con Dinamite.
    assert.deepEqual([stordy.points, stordy.played, stordy.setsWon, stordy.setsLost], [2, 2, 3, 4]);
    assert.equal(p.standingsChanges.length, 3);
  });

  test("tutto già allineato: niente da applicare", () => {
    const teams: DbTeam[] = [
      { id: 1, name: "CUSBros", isUs: true, officialId: 51 },
      { id: 2, name: "Stordyteam", isUs: false, officialId: 56 },
      { id: 3, name: "Dinamite", isUs: false, officialId: 45 },
    ];
    const away = match({
      id: 11,
      number: 46,
      phase: "ritorno",
      round: 2,
      startsAt: new Date("2027-02-03T20:20:00Z"),
      home: false,
      opponentId: 3,
      venue: "PALESTRA PANZINI — Bellaria (RN)",
      status: "scheduled",
      sets: [],
    });
    const standings = [
      { teamId: 1, points: 3, played: 1, won: 1, lost: 0, setsWon: 3, setsLost: 0 },
      { teamId: 2, points: 2, played: 2, won: 1, lost: 1, setsWon: 3, setsLost: 4 },
      { teamId: 3, points: 1, played: 1, won: 0, lost: 1, setsWon: 1, setsLost: 3 },
    ];
    const p = planOfficialImport(official, { teams, matches: [match({}), away], standings }, "CUSBros");
    assert.ok(planIsEmpty(p), JSON.stringify({ updates: p.updates, standings: p.standingsChanges }));
  });

  test("nome di una squadra nuova dal maiuscolo del sito", () => {
    assert.equal(prettyTeamName("O.B.C. VOLLEY"), "O.B.C. Volley");
    assert.equal(prettyTeamName("RE START VOLLEY"), "Re Start Volley");
  });
});
