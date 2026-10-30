# Roadmap CUSBros

Riferimento: [`design_handoff_cusbros/README.md`](../design_handoff_cusbros/README.md). Ogni step si chiude con lint + build verdi, un riepilogo "come provarlo" e conferma prima di passare al successivo.

**Git:** si lavora su `dev`; a step completato e verificato → merge su `main`. Branch `feat/xxx` (da `dev`) solo per i lavori grossi, segnati con 🌿. Un commit per macro sezione.

Legenda: `[ ]` da fare · `[x]` fatto · `[~]` in corso

---

## 0 · Setup repo ✅
- [x] Next.js 15 + TypeScript + Tailwind v4 + ESLint, `src/`
- [x] `.env.example`, `.gitignore`, `.gitattributes` (LF)
- [x] README di progetto, branch `main` / `dev`

## 1 · Fondamenta UI + pagine pubbliche (dati finti) ✅
- [x] Token di design in `@theme` (`globals.css`), radius, focus oro, `tabular-nums`
- [x] Font `next/font`: Barlow Condensed (500–800) + Barlow (400–600)
- [x] Logo in `public/`, favicon da logo
- [x] Layout pubblico: Nav + Footer (max-w 1200 Home / 1000 Calendario)
- [x] Dati finti strutturati come il modello dati (poi sostituiti dal DB nello step 2), letti da `src/lib/data.ts`
- [x] Home: hero, prossima partita + **Countdown** (client), ultimo risultato, classifica top 5, CTA
- [x] Calendario: riepilogo, filtro segmentato, card partite, classifica completa `#classifica`
- [x] Date/ore formattate in `Europe/Rome`

## 2 · Database + autenticazione ✅
- [x] Progetto Neon (free), `DATABASE_URL` e `AUTH_SECRET` in `.env`
- [x] Drizzle: schema completo (users, seasons, teams, matches, match_sets, standings, players, match_players, lineups, events) + migrazione `0000_init`
- [x] Seed: stagione, squadre, calendario, classifica, rosa (`npm run db:seed`); utenti con `npm run user:create`
- [x] Home e Calendario leggono dal DB (Server Components + `revalidate`)
- [x] Auth.js v5 Credentials (bcrypt), JWT con `role`, scadenza 30 giorni
- [x] `middleware.ts` su `/admin/**` → `/admin/login`
- [x] Pagina Admin Login + shell admin (header, tab, Esci) con segnaposto delle 4 sezioni
- [x] Verifica end-to-end su Neon reale (migrate, seed, build, login vero, Esci)

## 3 · Admin Partite + Giocatori ✅
- [x] Partite: lista, form espandibile, parziali validati, crea/modifica/elimina con conferma
- [x] Scorciatoie: orari frequenti (i 3 più usati), autocompletamento palestra e avversario, "Usa palestra di casa", "Duplica come ritorno"; fase andata/ritorno, numero gara, partite rinviate e a tavolino
- [x] Gestione classifica (`/admin/partite/classifica`, G = V + P calcolato)
- [x] `revalidatePath` di Home e Calendario dopo ogni modifica
- [x] Giocatori: lista + form (numero, nome, cognome, ruolo, sesso facoltativo, attivo), scheda base con presenze/stelline/MVP; numero unico tra gli attivi; eliminazione solo senza dati di partita (altrimenti si disattiva)

## 4 · Live 🌿 `feat/live` ✅
- [x] Prepara Live: wizard Presenti (con ruolo di partita) → Formazione (avviso donne) → Inizio (+ scorciatoie); salva presenze, formazione set 1 e chi batte, partita "in corso"
- [x] Live online: tabellone, Semplice / Avanzato, campo, rotazione automatica + manuale, Annulla/Ripeti (stato sempre ricalcolato dal registro eventi)
- [x] Cambi (n/6, ruolo di chi entra, avviso rientro), libero (non conta come cambio, esce da solo in P4), timeout, correzione punteggio, formazione set successivo, fine set (25/15 con +2), fine partita + MVP (parziali ricalcolati sul server)
- [x] Feed ultime azioni + Annulla/Ripeti, eventi `incomplete` ("da completare")
- [x] API `POST /api/matches/[id]/events` batch idempotente (uuid client), coda di invio con nuovi tentativi
- [x] Test nel repo: `npm test` (logica del Live, validazioni partite/eventi/Prepara Live, date, formazione) e `npm run test:e2e` (Playwright: Prepara Live → Live → 3 set → MVP su partita temporanea, copia e ripristino verificato del DB), `npm run test:restore` per i test interrotti
- [x] Offline: copia locale del registro su IndexedDB (`src/lib/live/local-log.ts`, ogni azione salvata subito, `pending` finché il server non conferma), unione con il registro del server all'apertura (`merge.ts`), invio su `online` / ritorno sull'app + nuovi tentativi, indicatore "Offline · N azioni in coda" / "Sincronizzato"; "Concludi partita" chiede la rete
- [x] Service worker scritto a mano (`public/sw.js`, solo in produzione) invece di `@serwist/next` (che richiede webpack, la build usa Turbopack): pagina `/admin/live/<id>` prima dalla rete (attesa max 4 s) poi dalla copia salvata, file statici di Next/font/logo dalla cache. Verificato con `tests/e2e/offline.spec.ts` sulla build di produzione
- [x] Invio robusto: blocchi da 100 eventi; un evento rifiutato dal server (400/422) si mette da parte e non blocca gli altri (avviso "azioni scartate", sparisce se si annulla/rifà); sessione scaduta → "Sessione scaduta · N in coda" + link per rientrare; "Esci" cancella copia locale e pagine salvate solo a coda vuota (altrimenti chiede conferma), senza rete non esce. Test: `tests/e2e/sync.spec.ts`
- Limiti noti dell'offline: un solo telefono per partita (due telefoni offline sulla stessa partita creerebbero eventi in conflitto); la cache dei file statici cresce a ogni deploy (si azzera cambiando `VERSION` in `sw.js`); le pagine diverse dal Live non si aprono offline.
- [x] Campo come mini campo (rete, prima/seconda linea, ruoli) anche in Prepara Live e formazione set; **posto del libero sempre visibile**: entrata con un tocco per il centrale in seconda linea (non per chi sta per battere), uscita, scambio libero A ↔ B e scelta del libero a set iniziato, mai conteggiati come cambi
- [x] **Azzera il Live** (Prepara Live, solo partite in corso, doppia conferma con il nome dell'avversario, controllata anche dal server): via azioni, formazione e presenti, la partita torna da giocare; la copia del telefono è legata al Live (formazione del 1° set) e quella di un Live precedente si scarta da sola
- [x] **Libero automatico sui centrali** (pallino blu sui centrali): entra da solo per il centrale in seconda linea e si alterna sui due (esce in P4, entra per l'altro; se il centrale è in P1 e batte, entra quando perdiamo la battuta). Uscito a mano non rientra da solo finché quel centrale è in seconda linea; tutti i bottoni manuali restano. È calcolato dallo stato (nessun evento): sul server, senza ruoli, i parziali non cambiano
- [x] Annulla/Ripeti anche dopo un ricaricamento: la pila si salva sul telefono a ogni tocco (`undo-store.ts`, legata al Live in corso, ultime 300 operazioni) e si riprende identica; se manca o non torna col registro (azioni fatte altrove, dati cancellati) si ricostruisce dal registro (`restoreHistory` in `history.ts`: Annulla toglie l'ultima azione valida, poi la precedente). Si cancella con la copia del registro (fine partita, azzeramento, nuovo Live, Esci).
- [x] MVP facoltativo alla chiusura ("Concludi senza MVP"); si sceglie o si cambia anche dopo dallo Storico.
- [x] Partita conclusa: dallo Storico "Riapri nel Live" (torna in corso con tutte le azioni, parziali tolti fino alla nuova chiusura, l'MVP salvato resta proposto) e "Azzera il Live" (doppia conferma, via anche risultato e MVP). Per le prove: partita futura → Live → conclusa → Azzera.
- [x] Chiusura (28/10/2026): prove di Max su iPhone (Vercel), E2E verdi su dev e su build di produzione con service worker, DB ripristinato e verificato; partita e squadra TEST-volley eliminate (per le prove si usa una partita futura e poi "Azzera il Live"). Merge `feat/live` → `dev` → `main` fatto.

## 5 · Storico, statistiche, riepilogo pubblico 🌿 `feat/storico` ✅
- Decisioni (28/10/2026): nello Storico si correggono **solo le partite concluse** (quelle in corso in sola lettura, così Storico e telefono del Live non si sovrascrivono). Le partite con il risultato inserito a mano (es. n. 15 con Stordyteam) non hanno azioni: niente Storico né statistiche per loro.
- [x] Storico live (`/admin/storico`, 🌿 `feat/storico`): partite registrate col Live (dalla più recente), set con il numero di azioni da completare, filtri Tutte / Da completare · N / Solo ★, azioni dalla più recente con il punteggio ricalcolato; modifica di fondamentale, esito, giocatore e ★ (il punto si ricava dall'esito), Elimina (come nel Live: resta nel registro annullato), "+ Aggiungi azione" in fondo al set o dopo un'azione, "Salva e prossima →". Ogni modifica ricalcola sul server tutta la partita e riscrive i parziali; è rifiutata se la partita non risulta più finita o un set chiuso non ha un punteggio di fine set (per spostare un punto si aggiunge prima l'azione che manca). Le partite in corso sono in sola lettura e l'API del Live rifiuta (422) azioni per partite concluse. Logica in `src/lib/live/storico.ts`, test in `tests/unit/live-storico.test.ts`
- [x] Giocatori: efficienza per fondamentale (formule del README, % intera, oro ≥50 / rosso <30) dalle partite **concluse** registrate col Live; card dei fondamentali dei ruoli giocati più quelli fuori ruolo con azioni; ogni partita conta nel **ruolo di quel giorno** (presenti di Prepara Live, o ruolo del cambio con cui è entrato) e con più ruoli si sceglie "Tutti / Centrale · N / Banda · N". Nota in scheda: in Semplice si segnano solo punti ed errori. Logica in `src/lib/stats.ts`, test in `tests/unit/stats.test.ts`
- [x] Grafico Andamento nella scheda giocatore (`trend-chart.tsx`, SVG a mano): ultime 12 partite con azioni del fondamentale scelto (segue anche il ruolo scelto), linea oro, griglia ogni 50% (scende sotto lo 0 quando l'efficienza è negativa), bande della finestra di 3 partite migliore (oro) e peggiore (rossa) con legenda; si tocca un punto per leggere partita, % e azioni (sul telefono non c'è hover), "Vedi i numeri" apre l'elenco. Area di disegno ridotta rispetto al prototipo (640×240) perché a 320px le scritte restino leggibili. Compare da 2 partite
- [x] Pagina pubblica `/partite/[id]` (solo partite concluse, altrimenti 404): meta (giornata, n. gara, data, palestra), score grande casa → ospite con VINTA/PERSA, parziali, MVP (ruolo, punti, % in attacco, ★), come abbiamo fatto punto (attacco / muro / ace / errori avversari, "Altro" per i punti mai completati), i migliori (attacco, muro, battuta, ricezione con almeno 3 ricezioni), squadra a confronto (punti totali, conquistati, regalati con errori, serie più lunga: dell'avversario si conoscono solo punti ed errori). Partite col solo risultato o a tavolino: risultato e parziali con una nota. Si aggiorna con `revalidatePublicPages()` (anche dallo Storico). Logica in `src/lib/match-report.ts`, test in `tests/unit/match-report.test.ts`; l'E2E del Live ora prova anche Storico e riepilogo pubblico

## 6 · PWA + deploy
- [x] Manifest + icone 192/512 (+ maskable, apple-touch 180) dal logo su fondo `bg`: due app installabili, "CUSBros" (da sito pubblico, apre `/`) e "CUSBros Staff" (da `/admin/**`, apre `/admin`), schermo intero (`display: standalone`)
- [x] Progetto Vercel collegato al repo (deploy da `main`, https://volley-squad.vercel.app), env `DATABASE_URL` + `AUTH_SECRET`, funzioni in `fra1` (`vercel.json`) vicino a Neon `eu-central-1`
- [~] Verifica su telefono reale: Live provato da Max su iPhone (28/10/2026), app installata a schermo intero; manca la prova **offline in palestra** in una partita vera
- Nota **iPhone:** Safari cancella cache e dati di un sito non aperto da 7 giorni se non è installato sulla Home → installazione PWA consigliata per chi registra il Live; in ogni caso aprire il Live con la rete prima della partita (scritto anche nel README)
- [x] Merge `dev` → `main` (28/10/2026, compreso l'import dal sito ufficiale): `main` e `dev` sono allineati

## 7 · Miglioramenti dopo la prima partita col Live (feedback di Max, 29/10/2026)
- [x] Animazioni leggere tra le pagine (CSS, `page-enter` nel pubblico, `page-fade` nello staff via `template.tsx`; niente con "Riduci movimento")
- **Fase 1 · Formazione e cambi**
  - [x] Presenti divisi per ruolo nella scelta della formazione (Prepara Live e set successivi)
  - [x] Ruolo consigliato per ogni posizione dallo schema 5-1 (P S C O S C, opposti P1–P4, P2–P5, P3–P6) a partire da chi è già in campo: scritto nelle caselle vuote e gruppo in cima ai presenti (`suggestedRoles`, `groupByRole` in `src/lib/lineup.ts`)
  - [x] "⇄ Scambia due posizioni" nella formazione
  - [x] Cambi: in panchina prima lo stesso ruolo di chi esce
- **Fase 2 · Live più chiaro**
  - [x] Scelta del giocatore dopo un +1 disposta come il campo (P4 P3 P2 / P5 P6 P1 con la posizione, libero in fondo quando serve)
  - [x] Timeout +1 / −1 (il −1 annulla l'ultimo timeout di quella squadra nel set, `lastTimeout` in `state.ts`)
  - [x] "⇄ Scambia" sul campo del Live: due giocatori in campo si scambiano di posto (evento `swap`, migrazione `0007`), non conta come cambio, si annulla con Annulla e si elimina dallo Storico
- **Fase 3 · Semplice più ricca** — decisioni del 29/10/2026:
  - [x] +1 avversario con tutti i motivi: Punto avversario, Errore battuta, Attacco fuori / rete, Murato, Ricezione errata, Errore alzata, Invasione a muro / rete, Doppia / accompagnata (poi chi), Fallo di posizione (di squadra, senza giocatore: `isTeamFault`)
  - [x] "Errore avversario" col tipo, un tocco (`OPP_ERRORS` in `skills.ts`, `detail.oppError`): Battuta sbagliata, Attacco fuori, Attacco in rete, Invasione / rete, Doppia / accompagnata, Fallo di posizione, Altro. Al posto di "palla semplice nostra / azione loro" (`ballType` resta solo per leggere le partite vecchie; nello Storico diventano "Altro")
  - [x] Azioni senza punto, riga di tasti sotto i +1: **Ricezione buona**, **Ricezione scarsa** (anche il libero), **Attacco giocato**, poi il giocatore (`SIMPLE_RALLY_TYPES`) → statistiche vere anche in Semplice (es. 5 punti su 10 attacchi)
- **Fase 4 · Statistiche pubbliche** 🌿 `feat/statistiche` — decisioni del 30/10/2026: pubbliche (anche le % negative, per ora), si arriva dal bottone "Statistiche" in alto e toccando un nome nel riepilogo di una partita
  - [x] Calcoli: punti giocati (chi era in campo a ogni punto, libero compreso: `LiveState.rallies`), set giocati e set interi (`playingTime`), punti fatti ed errori per giocatore (`pointsAndErrors`), punti regalati per tipo (`pointsGiven`), errori avversari per tipo (`oppErrorSplit`) in `src/lib/stats.ts`
  - [x] `/statistiche` (bottone "Statistiche" nel menu pubblico, che ora ha due link): filtro stagione / singola partita, squadra (partite V/P, punti fatti e subiti, come abbiamo fatto punto con gli errori avversari per tipo, come hanno fatto punto loro), tabella dei giocatori ordinabile (punti, errori, partite, set e set interi, punti giocati, fondamentali con % e riusciti/totali; prima colonna fissa). Punti fatti/subiti dai parziali veri, con la voce "Corretti a mano" per i punti aggiunti con Correggi (nella partita del 28/10 sono 9 e 26); ordinando un fondamentale prima chi ha almeno 3 azioni. Numeri di ogni partita calcolati sul server (`src/lib/stats-data.ts`), somma e ordinamento sul telefono (`src/lib/stats-season.ts`, `stats-board.tsx`); si aggiorna con `revalidatePublicPages()`
  - [x] `/statistiche/[id]` scheda giocatore (si apre dalla tabella, dall'MVP e da "I migliori" nel riepilogo della partita): filtro stagione / partita e per ruolo giocato, partite, set (interi), punti giocati, punti fatti, errori, ★ e MVP, fondamentali del ruolo in evidenza (anche senza azioni) e fuori ruolo con ogni esito contato, Andamento, partita per partita. Componente unico `src/components/player-stats/` usato anche da Admin Giocatori (con link "Scheda pubblica"): tolto il calcolo duplicato della pagina staff
- **Amichevoli** (idea di Max del 30/10/2026, da progettare dopo la fase 4):
  - [ ] Partita segnata come **amichevole** (nuovo campo della partita, da Admin Partite); il Live funziona uguale
  - [ ] Filtro nel Calendario/Home pubblici (ufficiali / amichevoli)
  - [ ] Statistiche e scheda giocatore con filtro **Ufficiali / Tutte / Solo amichevoli** (di base solo le ufficiali, così le amichevoli non pesano sui numeri)
  - Da decidere: non entrano in classifica né nell'import dal sito ufficiale (non hanno numero gara); se mostrarle in Home come "prossima partita"

## 🔒 Sicurezza (sito online)
- [x] Controllo del 28/10/2026: middleware su `/admin/**` + controllo in pagine, server action e API; login con bcrypt, messaggio e tempi uguali per email sconosciuta o password sbagliata, redirect solo interni; segreti solo in `.env`; area staff `noindex`.
- [x] Utente eliminato → accesso finito subito (prima restava valido il JWT fino a 30 giorni): `currentStaff()` ricontrolla l'utente nel DB, `/admin/sessione-scaduta` chiude la sessione senza giri di redirect.
- [x] Intestazioni di sicurezza su tutte le pagine (`X-Frame-Options`, CSP `frame-ancestors 'none'`/`form-action 'self'`/`object-src 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), niente `X-Powered-By`.
- [x] Test: `tests/e2e/security.spec.ts` (accesso, API, intestazioni, noindex, login, redirect, utente eliminato) e `tests/unit/security.test.ts` (redirect del login).
- [x] **Limite ai tentativi di accesso** (tabella `login_attempts`, migrazione `0005`): in 15 minuti 5 errori per email+connessione, 20 per connessione, 50 per email (largo apposta: chi conosce un'email non può bloccare il proprietario con pochi tentativi). Controllato dentro Auth.js (`authorize`), così vale anche chiamando l'endpoint direttamente; dopo un accesso riuscito si azzerano i tentativi dell'email. Logica in `src/lib/login-limit.ts`, test unitari ed E2E.
- [ ] CSP completa anche per script e stili: richiede i nonce di Next, da valutare solo se serve.

## 💡 Idee future
- [x] **Import dal sito ufficiale** (SportAdmin) 🌿 `feat/import`: Admin → Partite → **Ufficiale**, bottone "Controlla il sito ufficiale" (la pagina si legge solo su richiesta) → differenze → "Applica". Nostre partite riconosciute dal numero gara (data, ora, palestra, casa/trasferta, avversario, risultato se non registrate col Live; con il Live solo un avviso), partite nuove create, squadre collegate con l'id ufficiale (`teams.official_id`, migrazione `0006`) o create, classifica copiata dal sito (punti, G, V, P) con i set calcolati dai parziali. Lettura in `src/lib/official/parse.ts` (`node-html-parser`), confronto in `diff.ts`, test con una pagina finta in `tests/unit/fixtures/`.
- Giornate di riposo nel Calendario pubblico: **non servono per ora** (Max, 30/10/2026).
- Loghi delle squadre: **non per ora** (Max, 30/10/2026).
- [x] **Animazioni leggere tra le pagine** (fatte, vedi sezione 7): transizioni morbide (fade/slide brevi) senza librerie pesanti, es. View Transitions API del browser o CSS puro; rispettare `prefers-reduced-motion`.

---

## 📌 Da fare (Max)
- [x] **Neon:** progetto creato, `.env` compilato.
- [x] **Utente admin** creato.
- [ ] **Allenatori:** crea i 2 utenti `coach` con `npm run user:create -- <email> "<nome>" coach`.
- [x] **Sesso dei giocatori** impostato per tutti i 14 (serve all'avviso "almeno 2 donne in campo").
- [x] **Classifica:** si copia dal sito ufficiale con "Applica" (resta modificabile a mano da Partite → Classifica).
- [x] **"Andata" nel Calendario:** aggiunta la fase (andata/ritorno) e il numero gara ufficiale.
- [x] **Rosa vera:** 14 giocatori caricati (27/10/2026).
- [x] **Numeri di maglia veri** inseriti.
- [ ] **Cognomi mancanti** (al 29/10/2026: Claudio, Francesco, Kevi, Maria Chiara, Erika): si sistemano da Admin Giocatori.

## ✅ Decisioni sul gioco (27/10/2026)
- **Ruoli variabili:** ruolo principale in anagrafica; **ruolo per partita** scelto in Prepara Live (proposto quello dell'anagrafica); nei **cambi** si indica in che ruolo entra (proposto quello di chi esce). Variabili: Capelli, Claudio (anche adattatore), Clementi, Placucci, Kevi, Botticelli, Fish.
- **Misto:** almeno **2 donne** in campo → solo **avviso a schermo**, mai blocco. Serve il sesso in anagrafica (facoltativo, impostato a mano).
- **Libero:** non può essere il primo a battere nel suo turno: quando la rotazione lo porta in battuta rientra il centrale e batte; **dalla battuta successiva** il libero può prendere il suo posto anche in battuta. Due liberi in rosa (Federici, Casadei); le entrate/uscite del libero non contano come cambi.
- **Nel Live (step 4):** timeout (2 per set), correzione manuale del punteggio, **indietro/avanti** sui tocchi (avanti solo finché non si fa una nuova azione), stato sempre ricalcolato dal registro eventi così non si rompe a metà.
- **Partite:** stati **rinviata** e **a tavolino** (vinta/persa 3–0).
- Già previsti dal regolamento e da gestire come avvisi: max 6 cambi per set, rientro del titolare solo al posto di chi l'ha sostituito, alternanza di chi batte a inizio set (5° set a sorteggio).

## Note e decisioni aperte
- **Campionato reale:** Libertas Cup Mix 2027, girone Challenge (Rimini). Fonte: [calendario ufficiale SportAdmin](https://sportadmin.net/s/libertas-volley-comitato-provinciale-rimini). I dati dei prototipi (Bologna, PalaCUS, squadre) erano inventati e sono stati sostituiti il 27/10/2026.
- **Classifica:** dal sito ufficiale (Partite → Ufficiale → Applica), con i set calcolati dai parziali di tutte le gare del girone; la modifica a mano resta possibile.
- **npm audit:** 2 avvisi su `postcss` interno a Next 15 (solo build-time). La "fix" proposta è passare a Next 16: non applicata, si rivaluta quando esce una patch 15.x. Altri avvisi `esbuild` arrivano da `drizzle-kit` (solo CLI in locale, non va in produzione).
- **Auth.js v5** è ancora in beta: versione bloccata a `5.0.0-beta.32`, aggiornare solo di proposito.
- **Password dimenticata:** per ora solo messaggio "contatta l'admin".
- **Stato al 29/10/2026:** step 0–5 completati, più sicurezza e import dal sito ufficiale; tutto unito su `dev` e su `main` (online su Vercel), nessun branch `feat` aperto. Restano: prova del Live **offline in palestra** in una partita vera (step 6), utenti `coach` e cognomi mancanti (Max), idee future ancora aperte (giornate di riposo, loghi, animazioni). Il dev server si avvia con `npm run dev` (porta 3001).
