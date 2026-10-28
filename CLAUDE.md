# CUSBros — istruzioni per Claude

Web app della squadra di pallavolo mista **CUSBros** (Libertas Cup Mix 2027, girone Challenge, Rimini): sito pubblico + area staff con registrazione live delle partite. Si usa soprattutto **da telefono**.

- Specifica e prototipi: `design_handoff_cusbros/README.md` e `design_handoff_cusbros/design/*.dc.html` (riferimenti visivi, non codice da copiare; **i dati dei prototipi sono inventati**: Bologna, PalaCUS, squadre fittizie).
- Avanzamento, decisioni e cose da fare: **`docs/ROADMAP.md`** (leggerla sempre all'inizio).
- Avvio e comandi: `README.md`.

## Come lavorare con Max
- UI e testi **in italiano**; anche commenti e messaggi di commit.
- **Step piccoli e verificabili**: a fine step dire cosa è stato fatto e come provarlo in locale, poi **fermarsi per conferma**.
- Se qualcosa è ambiguo, **chiedere** invece di indovinare. Lo stack è deciso: non cambiarlo senza chiedere.
- **Git**: `main` stabile, `dev` lavoro quotidiano, `feat/xxx` per lavori grossi (ora `feat/storico`). Commit per **macro sezione**, messaggio **solo titolo** (niente corpo), es. `feat: admin giocatori e rosa reale`. A fine step comunicare il nome del commit. **Il push lo fa Max.**
- Segreti solo in `.env` / `.env.local` (mai committati).

## Stack
Next.js 15 App Router + TypeScript · Tailwind v4 (token in `@theme` dentro `src/app/globals.css`, niente `tailwind.config`) · Neon Postgres + Drizzle ORM (driver HTTP) · Auth.js v5 beta bloccata a `5.0.0-beta.32` (Credentials, JWT 30 giorni, ruoli `admin`/`coach`) · zod v4 · npm · deploy Vercel. Tutto nei piani gratuiti.

## Regole di UI
- Solo i **token di design** del tema (`bg`, `surface`, `line`, `ink`, `muted`, `faint`, `gold`, `blue`, `red`, `green`…): le palette di Tailwind sono azzerate apposta. Font: `font-display` (Barlow Condensed) per titoli/numeri/bottoni, `font-sans` (Barlow) per il testo.
- Interlinea `normal` come nel design (già impostata nel tema: non reintrodurre le line-height di Tailwind).
- Mobile-first: target touch **≥ 44px**, input **≥ 16px**, nessuno scroll orizzontale a 320px.
- Date sempre in **Europe/Rome** (`src/lib/format.ts`, anche `fromRomeInput` per gli input).

## Architettura (dove stanno le cose)
- `src/lib/`: logica condivisa, senza dipendenze dal server dove possibile.
  - `club.ts` costanti (TEAM_NAME, palestra di casa, link ufficiale) · `matches.ts` punteggi/titoli/fasi · `players.ts` ruoli e nomi · `lineup.ts` formazione (anche `roleMismatches`) · `format.ts` date · `data.ts` letture per le pagine pubbliche · `actions.ts` `ActionResult`, `invalid()`, `revalidatePublicPages()` (home, calendario, `/partite/[id]`) · `auth-guard.ts` `currentStaff()` / `requireStaff()` (sessione **e** utente ancora esistente).
  - `stats.ts` statistiche giocatori (conteggi, efficienza con le formule del README, card per ruolo, ruolo di partita, finestre migliore/peggiore, `formatPct`) · `match-report.ts` riepilogo pubblico (come abbiamo fatto punto, i migliori, confronto, riga MVP) · `login-limit.ts` soglie del limite ai tentativi di accesso (il controllo è in `src/auth.ts`, tabella `login_attempts`).
  - `live/`: **il Live è event-sourced**. `state.ts` (`computeLive`) ricostruisce punteggio, battuta, rotazione, cambi, libero, timeout e set **solo dal registro eventi** (nessun punteggio salvato a parte). `history.ts` Annulla/Ripeti, `skills.ts` fondamentali ed esiti, `describe.ts` testi del feed, `types.ts` tipi ed `EVENT_KINDS`, `db.ts` lettura del registro, `event-schema.ts` validazione.
    - `storico.ts` correzioni dello Storico (modifica di un'azione con il punto ricavato dall'esito, righe di un set col punteggio, posizione di un'azione aggiunta, `finishedIssue`: partita ancora finita e set chiusi validi). Il libero entra ed esce da solo sui centrali quando `computeLive` riceve i ruoli (`baseRole`).
    - **Offline:** `local-log.ts` copia del registro su IndexedDB (salvata a ogni azione, `pending` fino alla conferma del server, legata al Live in corso con l'id della formazione del 1° set: quella di un Live precedente si scarta), `merge.ts` unione server + locale all'apertura, `offline-page.ts` registra `public/sw.js` (solo in produzione; in dev non c'è service worker). Il service worker tocca solo `/admin/live/<id>` e i file statici: se si cambia cosa mette in cache, aumentare `VERSION` in `sw.js`.
- `src/db/`: `schema.ts` (Drizzle), `index.ts` (`db`, `runBatch` = transazione), `seed.ts` (dati reali), `errors.ts`.
- `src/app/(public)/`: Home, Calendario e riepilogo `/partite/[id]` (solo partite concluse; Server Components con `revalidate`).
- `src/app/admin/(staff)/`: Partite (+ Classifica), Giocatori (scheda con efficienza e grafico Andamento), Live (`/admin/live` Prepara Live con "Azzera il Live", `/admin/live/[matchId]` il Live), Storico (`/admin/storico`, solo partite concluse: ogni modifica ricalcola sul server tutta la partita e i parziali; pannello "Partita" con MVP, Riapri nel Live, Azzera il Live). `/admin/sessione-scaduta` chiude la sessione di un utente non più esistente.
- `src/app/api/matches/[id]/events`: upsert idempotente degli eventi del Live (base dell'offline); rifiuta (422) le partite concluse.
- `src/components/`: `ui/` (comuni), `public/`, `admin/` (stili condivisi, `PageHeader`, `SegmentedField`, `lineup-picker`).

## Convenzioni di codice
- Ogni server action: `requireStaff()` → validazione zod → scrittura → `revalidate…` → `ActionResult`. Pagine e route staff: `currentStaff()`.
- Sicurezza: intestazioni in `next.config.ts` (niente cornici, nosniff, referrer, permissions); non aggiungere redirect presi dall'utente senza controllo (vedi `admin/login/safe-redirect.ts`).
- **zod solo sul server**: per ogni form c'è `*-form.ts` (tipi e costanti, importabile dal client) e `*-schema.ts` (zod, importato solo dalle action). Non importare file con zod nei componenti client (finisce nel bundle del telefono).
- Più scritture insieme → `runBatch([...])`.
- Non duplicare: prima cercare in `src/lib` e `src/components/admin` (es. `matchScore`, `matchTitle`, `shortTeamName`, `fullName`, `SegmentedField`, `PageHeader`).
- Nessun comando di "reset" del DB nel repo: il database contiene **dati reali**.
- Schema: modificare `src/db/schema.ts` → `npm run db:generate` → controllare l'SQL → `npm run db:migrate`.

## Verifiche prima di ogni commit
`npx tsc --noEmit` · `npm run lint` · `npm test` · prova nel browser (dev server su http://localhost:3001, porta fissa nello script) e, se si tocca il Live, `npm run test:e2e`; a fine step `npm run build` (fermare prima il dev server: usano la stessa cartella `.next`).

**Test:** logica in `tests/unit/` (`node:test` via `tsx`, niente DB); E2E in `tests/e2e/` (Playwright: `live` percorso completo fino a Storico e riepilogo pubblico, `offline`, `sync`, `security`). Nuove regole del Live, dello Storico, delle statistiche o delle validazioni → nuovo caso in `tests/unit/`. Prove al volo: script temporanei in `tests/e2e/_*.ts` (per gli import `@/`), da eliminare subito, con copia e verifica del DB; per le prove si può usare anche una partita reale futura (non la prossima) purché torni identica.

**Test sul DB reale (Neon):** sempre con **copia delle tabelle prima e ripristino identico dopo**, verificato (in passato un test ha cancellato un giocatore e cambiato date: recuperati). Negli E2E lo fa già `tests/e2e/global-setup.ts` (copia anche su file, partita e utente temporanei, ripristino in transazione, verifica); usare quello anche per nuovi E2E. Script a parte: stessa regola, con utente temporaneo via `npm run user:create` + `NEW_USER_PASSWORD`, eliminato alla fine.
- **Mai E2E mentre qualcuno usa l'app sul DB reale** (es. Max che prova dal telefono): il ripristino riporta il DB a com'era all'avvio del test e cancellerebbe le sue azioni. Chiedere prima.
- Porta fissa **3001** per `npm run dev` e `npm start` (sulla 3000 gira un'altra app di Max). Gli E2E puntano lì; per un'altra porta `E2E_BASE_URL` (il setup si rifiuta di partire se il server non è CUSBros).

## Insidie note (Windows)
- I file devono restare con fine riga **LF** (`.gitattributes`). Se si modificano file con script Python usare `open(..., newline="")`; il `grep` di Git Bash non vede i CR, controllare i byte.
- Non usare `prettier` sui file: il progetto non ha una sua configurazione e riformatterebbe tutto.
