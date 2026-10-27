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
- [x] `src/lib/mock-data.ts` strutturato come il modello dati, letto da `src/lib/data.ts`
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
- [x] Scorciatoie: orari frequenti (i 3 più usati), autocompletamento palestra e avversario, "Usa PalaCUS", "Duplica come ritorno"
- [x] Gestione classifica (`/admin/partite/classifica`, G = V + P calcolato)
- [x] `revalidatePath` di Home e Calendario dopo ogni modifica
- [x] Giocatori: lista + form (numero, nome, cognome, ruolo, attivo), scheda base con presenze/stelline/MVP; numero unico tra gli attivi; eliminazione solo senza dati di partita (altrimenti si disattiva)

## 4 · Live 🌿 `feat/live`
- [x] Prepara Live: wizard Presenti (con ruolo di partita) → Formazione (avviso donne) → Inizio (+ scorciatoie); salva presenze, formazione set 1 e chi batte, partita "in corso"
- [x] Live online: tabellone, Semplice / Avanzato, campo, rotazione automatica + manuale, Annulla/Ripeti (stato sempre ricalcolato dal registro eventi)
- [x] Cambi (n/6, ruolo di chi entra, avviso rientro), libero (non conta come cambio, esce da solo in P4), timeout, correzione punteggio, formazione set successivo, fine set (25/15 con +2), fine partita + MVP (parziali ricalcolati sul server)
- [x] Feed ultime azioni + Annulla/Ripeti, eventi `incomplete` ("da completare")
- [x] API `POST /api/matches/[id]/events` batch idempotente (uuid client), coda di invio con nuovi tentativi
- [ ] Offline: IndexedDB come coda, UI ottimistica, sync su `online` + retry, indicatore stato
- [ ] Service worker (`@serwist/next`): precache shell `/admin/live/*`, font, logo

## 5 · Storico, statistiche, riepilogo pubblico
- [ ] Storico live: tab partita, set, lista eventi editabile, filtri, "Salva e prossima →", ricalcolo punteggi
- [ ] Giocatori: efficienza per fondamentale, presenze / stelline / MVP
- [ ] Grafico Andamento (ultime 12, bande migliore/peggiore finestra di 3)
- [ ] Pagina pubblica `/partite/[id]`: score, parziali, MVP, come abbiamo fatto punto, migliori, confronto

## 💡 Idee future
- [ ] **Import dal calendario ufficiale** (SportAdmin): bottone in admin che rilegge calendario, risultati e classifica del girone e propone gli aggiornamenti.
- [ ] **Giornate di riposo** nel Calendario pubblico ("Riposa CUSBros", 7ª andata e ritorno), come sul sito ufficiale.
- [ ] **Loghi delle squadre** accanto ai nomi (come sul sito ufficiale).
- [ ] **Animazioni leggere tra le pagine:** transizioni morbide (fade/slide brevi) senza librerie pesanti, es. View Transitions API del browser o CSS puro; rispettare `prefers-reduced-motion`.

## 6 · PWA + deploy
- [ ] Manifest + icone 192/512 dal logo
- [ ] Progetto Vercel collegato al repo, env `DATABASE_URL` + `AUTH_SECRET`
- [ ] Verifica su telefono reale: installazione PWA, live offline in palestra
- [ ] Merge finale `dev` → `main`

---

## 📌 Da fare (Max)
- [x] **Neon:** progetto creato, `.env` compilato.
- [ ] **Utenti staff:** crea te stesso (`admin`) e i 2 allenatori (`coach`) con `npm run user:create`.
- [ ] **Classifica:** decidere se inserita a mano o calcolata. Il DB ha già la tabella `standings` (va bene per entrambe le strade).
- [x] **"Andata" nel Calendario:** aggiunta la fase (andata/ritorno) e il numero gara ufficiale.
- [x] **Rosa vera:** 14 giocatori caricati (27/10/2026).
- [ ] **Numeri di maglia veri** (ora provvisori 1–14) e **cognomi mancanti** (Claudio, Kevi, Francesco, Maria Chiara, Rebecca): si sistemano da Admin Giocatori.

## ✅ Decisioni sul gioco (27/10/2026)
- **Ruoli variabili:** ruolo principale in anagrafica; **ruolo per partita** scelto in Prepara Live (proposto quello dell'anagrafica); nei **cambi** si indica in che ruolo entra (proposto quello di chi esce). Variabili: Capelli, Claudio (anche adattatore), Clementi, Placucci, Kevi, Botticelli, Fish.
- **Misto:** almeno **2 donne** in campo → solo **avviso a schermo**, mai blocco. Serve il sesso in anagrafica (facoltativo, impostato a mano).
- **Libero:** non può essere il primo a battere nel suo turno: quando la rotazione lo porta in battuta rientra il centrale e batte; **dalla battuta successiva** il libero può prendere il suo posto anche in battuta. Due liberi in rosa (Federici, Casadei); le entrate/uscite del libero non contano come cambi.
- **Nel Live (step 4):** timeout (2 per set), correzione manuale del punteggio, **indietro/avanti** sui tocchi (avanti solo finché non si fa una nuova azione), stato sempre ricalcolato dal registro eventi così non si rompe a metà.
- **Partite:** stati **rinviata** e **a tavolino** (vinta/persa 3–0).
- Già previsti dal regolamento e da gestire come avvisi: max 6 cambi per set, rientro del titolare solo al posto di chi l'ha sostituito, alternanza di chi batte a inizio set (5° set a sorteggio).

## Note e decisioni aperte
- **Campionato reale:** Libertas Cup Mix 2027, girone Challenge (Rimini). Fonte: [calendario ufficiale SportAdmin](https://sportadmin.net/s/libertas-volley-comitato-provinciale-rimini). I dati dei prototipi (Bologna, PalaCUS, squadre) erano inventati e sono stati sostituiti il 27/10/2026.
- **Classifica:** probabilmente inserita a mano (le partite delle altre squadre non le registriamo). Vedi "Da fare".
- **npm audit:** 2 avvisi su `postcss` interno a Next 15 (solo build-time). La "fix" proposta è passare a Next 16: non applicata, si rivaluta quando esce una patch 15.x. Altri avvisi `esbuild` arrivano da `drizzle-kit` (solo CLI in locale, non va in produzione).
- **Auth.js v5** è ancora in beta: versione bloccata a `5.0.0-beta.32`, aggiornare solo di proposito.
- **Login:** nessun limite di tentativi per ora (uso interno, 3 utenti). Da rivalutare prima del deploy.
- **Password dimenticata:** per ora solo messaggio "contatta l'admin".
- **"Andata" nel Calendario:** testo fisso; il modello dati non ha la fase del campionato. Da decidere se aggiungerla.
- **`/partite/[id]`:** le card giocate ci linkano già; finché la pagina non esiste (step 5) danno 404.
