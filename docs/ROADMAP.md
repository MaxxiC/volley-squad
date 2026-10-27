# Roadmap CUSBros

Riferimento: [`design_handoff_cusbros/README.md`](../design_handoff_cusbros/README.md). Ogni step si chiude con lint + build verdi, un riepilogo "come provarlo" e conferma prima di passare al successivo.

**Git:** si lavora su `dev`; a step completato e verificato → merge su `main`. Branch `feat/xxx` (da `dev`) solo per i lavori grossi, segnati con 🌿. Un commit per macro sezione.

Legenda: `[ ]` da fare · `[x]` fatto · `[~]` in corso

---

## 0 · Setup repo ✅
- [x] Next.js 15 + TypeScript + Tailwind v4 + ESLint, `src/`
- [x] `.env.example`, `.gitignore`, `.gitattributes` (LF)
- [x] README di progetto, branch `main` / `dev`

## 1 · Fondamenta UI + pagine pubbliche (dati finti)
- [ ] Token di design in `@theme` (`globals.css`), radius, focus oro, `tabular-nums`
- [ ] Font `next/font`: Barlow Condensed (500–800) + Barlow (400–600)
- [ ] Logo in `public/`, favicon da logo
- [ ] Layout pubblico: Nav + Footer (max-w 1200 Home / 1000 Calendario)
- [ ] `src/lib/mock-data.ts` strutturato come il modello dati
- [ ] Home: hero, prossima partita + **Countdown** (client), ultimo risultato, classifica top 5, CTA
- [ ] Calendario: riepilogo, filtro segmentato, card partite, classifica completa `#classifica`
- [ ] Date/ore formattate in `Europe/Rome`

## 2 · Database + autenticazione
- [ ] Progetto Neon (free), `DATABASE_URL` in `.env.local`
- [ ] Drizzle: schema completo (users, seasons, teams, matches, match_sets, standings, players, match_players, lineups, events) + migrazioni
- [ ] Seed: stagione, squadre, calendario, classifica, rosa, utenti admin/coach
- [ ] Home e Calendario leggono dal DB (Server Components + `revalidate`)
- [ ] Auth.js v5 Credentials (bcrypt), JWT con `role`, scadenza 30 giorni
- [ ] `middleware.ts` su `/admin/**` → `/admin/login`
- [ ] Pagina Admin Login + shell admin (header, tab)
- [ ] ❓ Decisione: classifica inserita a mano o calcolata

## 3 · Admin Partite + Giocatori
- [ ] Partite: lista, form espandibile, parziali, crea/modifica/elimina con conferma
- [ ] Scorciatoie: orari frequenti, autocompletamento palestra, "Usa PalaCUS", "Duplica come ritorno"
- [ ] Gestione classifica (tabella editabile)
- [ ] `revalidateTag` delle pagine pubbliche dopo ogni modifica
- [ ] Giocatori: lista + form (numero, nome, cognome, ruolo, attivo), scheda base

## 4 · Live 🌿 `feat/live`
- [ ] Prepara Live: wizard Presenti → Formazione → Inizio (+ scorciatoie)
- [ ] Live online: tabellone, Semplice / Avanzato, campo, rotazione automatica + manuale
- [ ] Cambi (n/6), fine set (25/15 con +2), fine partita + MVP
- [ ] Feed ultime azioni + undo illimitato nel set, eventi `incomplete`
- [ ] API `POST /api/matches/[id]/events` batch idempotente (uuid client)
- [ ] Offline: IndexedDB come coda, UI ottimistica, sync su `online` + retry, indicatore stato
- [ ] Service worker (`@serwist/next`): precache shell `/admin/live/*`, font, logo

## 5 · Storico, statistiche, riepilogo pubblico
- [ ] Storico live: tab partita, set, lista eventi editabile, filtri, "Salva e prossima →", ricalcolo punteggi
- [ ] Giocatori: efficienza per fondamentale, presenze / stelline / MVP
- [ ] Grafico Andamento (ultime 12, bande migliore/peggiore finestra di 3)
- [ ] Pagina pubblica `/partite/[id]`: score, parziali, MVP, come abbiamo fatto punto, migliori, confronto

## 6 · PWA + deploy
- [ ] Manifest + icone 192/512 dal logo
- [ ] Progetto Vercel collegato al repo, env `DATABASE_URL` + `AUTH_SECRET`
- [ ] Verifica su telefono reale: installazione PWA, live offline in palestra
- [ ] Merge finale `dev` → `main`

---

## Note e decisioni aperte
- **Classifica:** probabilmente inserita a mano (le partite delle altre squadre non le registriamo). Da confermare prima dello step 2.
- **npm audit:** 2 avvisi su `postcss` interno a Next 15 (solo build-time). La "fix" proposta è passare a Next 16: non applicata, si rivaluta quando esce una patch 15.x.
- **Password dimenticata:** per ora solo messaggio "contatta l'admin".
