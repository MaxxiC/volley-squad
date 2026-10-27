# Handoff: CUSBros — sito squadra + area staff

## Overview
Web app per la squadra di pallavolo **CUSBros** (gioco di parole tra CUSB, la società, e "Bros").
- **Pubblico**: Home (logo, prossima partita con countdown, ultimo risultato, classifica), Calendario (tutte le partite, punteggi, classifica completa), Riepilogo partita (pubblico, da costruire — vedi sotto).
- **Staff** (non linkato dal pubblico, URL `/admin`): Login, Partite (modifica calendario), Giocatori (rosa + statistiche + andamento), Live (registrazione partita semplice/avanzata, offline), Storico live (correzione azioni).

Uso principale da **telefono**, poi tablet, poi desktop. Lingua UI: italiano.

## About the Design Files
I file in `design/` sono **riferimenti di design in HTML** (prototipi che mostrano aspetto e comportamento), non codice da copiare. Vanno ricreati in **Next.js (App Router) + TypeScript**. Aprili in un browser (servono `support.js` accanto e connessione per i Google Fonts). Lo stato e i dati sono finti, hardcoded nel `<script>` di ogni file: la logica (es. calcolo set, rotazione) è comunque un buon riferimento.

## Fidelity
**High-fidelity.** Colori, tipografia, spaziature e interazioni sono definitivi. Ricreare fedelmente.

## Stack (deciso)
- **Next.js 15** App Router, TypeScript, deploy su **Vercel** (free).
- **Neon** Postgres (free) + **Drizzle ORM** (consigliato) per schema/migrazioni.
- **Auth.js (NextAuth v5)** con Credentials provider (email + password, hash bcrypt/argon2). Sessione JWT con `role`.
- Styling: **Tailwind CSS** con i token sotto in `tailwind.config` (o CSS variables). Font via `next/font/google`: **Barlow Condensed** (500/600/700/800) e **Barlow** (400/500/600).
- Grafici: SVG a mano come nel design, oppure Recharts stilizzato uguale.
- **PWA**: manifest + service worker (es. `@serwist/next`) per installare su telefono e per l'offline del Live.
- Offline Live: **IndexedDB** (es. `idb` o Dexie) come coda locale; sync verso API quando torna la rete.
- Pagine pubbliche: Server Components con `revalidate` (o `revalidateTag` dopo ogni modifica admin).

## Ruoli e permessi
| Ruolo | Utenti | Permessi |
|---|---|---|
| `admin` | 1 (il proprietario) | tutto + gestione utenti |
| `coach` | 2 allenatori | tutto tranne gestione utenti |

Nessuna registrazione pubblica: utenti creati con uno script seed / da admin. Proteggere `/admin/**` con `middleware.ts` (redirect a `/admin/login`). Le pagine pubbliche non linkano mai l'admin.

## Routes
| Route | Design file | Note |
|---|---|---|
| `/` | `Home.dc.html` | pubblico |
| `/calendario` | `Calendario.dc.html` | pubblico, ancora `#classifica` |
| `/partite/[id]` | `Partita.dc.html` | riepilogo pubblico fine partita; linkato dalle card giocate del Calendario |
| `/admin/live` | `Admin Prepara Live.dc.html` | wizard pre-partita; il tab "Live" punta qui, "Inizia partita" → `/admin/live/[matchId]` |
| `/admin/login` | `Admin Login.dc.html` | |
| `/admin/partite` | `Admin Partite.dc.html` | default dopo login |
| `/admin/giocatori` | `Admin Giocatori.dc.html` | |
| `/admin/live/[matchId]` | `Admin Live.dc.html` | offline-first |
| `/admin/storico` | `Admin Storico.dc.html` | |

## Data model (Postgres)
```
users(id, email unique, name, password_hash, role 'admin'|'coach', created_at)
seasons(id, name '2026/27', is_current)
teams(id, name, is_us bool)                      -- avversari + CUSBros
matches(id, season_id, round int, starts_at timestamptz, home bool, opponent_id,
        venue text, status 'scheduled'|'live'|'finished', mvp_player_id null)
match_sets(id, match_id, n 1..5, us int, them int)          -- noi/loro, già orientati
standings(id, season_id, team_id, points, played, won, lost, sets_won, sets_lost) -- inserita a mano o calcolata
players(id, number, first_name, last_name, role 'P'|'S'|'O'|'C'|'L', active bool)
match_players(match_id, player_id)                 -- presenze
lineups(id, match_id, set_n, p1..p6 player_id, libero_id)
events(id uuid (client-generated), match_id, set_n, seq int, created_at,
       kind 'action'|'sub'|'rotation'|'set_end',
       player_id null, skill 'serve'|'reception'|'set'|'attack'|'block'|'fault'|'opp_error'|'opp_point',
       outcome text, point 'us'|'them'|null, star bool, incomplete bool,
       detail jsonb)  -- es. {ballType:'free'|'rally'} per errore avversario, {in,out} per cambi
```
Il punteggio di un set è **derivato** dagli eventi (somma `point`), non salvato a parte durante il live; a fine set si scrive `match_sets`. Lo Storico modifica `events` e ricalcola.

### Esiti per fondamentale (avanzato)
| skill | outcome → point |
|---|---|
| serve (Battuta) | ace → us · in → null · error → them |
| reception (Ricezione) | perfect/good/poor → null · error → them |
| set (Alzata) | good/poor → null · error → them |
| attack (Attacco) | kill → us · in → null · blocked → them · error → them |
| block (Muro) | point → us · touch → null · net → them |
| fault (Fallo) | invasion/double/position/other → them |
| opp_error / opp_point | → us / → them |

### Efficienza (Giocatori)
- Battuta: (ace − errori) / totale
- Ricezione: (perfette + buone×0.5 − errori) / totale
- Attacco: (punti − errori − murati) / totale
- Muro: punti / (punti + tocchi + invasioni)
- Alzata: buone / totale
Mostrare come % intera. Colore: ≥50% oro, <30% rosso `#e08a7c`, altrimenti ink.
**Andamento**: serie per partita (ultime 12) del fondamentale scelto. Evidenziare finestra di 3 partite consecutive con media massima (banda oro 12%) e minima (banda rossa 12%), con legenda testuale.

## Screens

### Shared — pubblico
- Sfondo `#0b0b0c`, ink `#f3efe6`. Root `overflow-x: clip`.
- Nav: max-width 1200 (Calendario 1000), padding `18px clamp(20px,5vw,48px)`; logo 40×40 + "CUSBROS" Barlow Condensed 700 20px ls .08em uppercase; a destra bottone outline (border `#3a352b`, radius 6, min-h 44, BC 600 16px ls .1em uppercase; hover border+text oro).
- Footer: border-top `#1f1d19`, 13px `#6f6a60`, "CUSBros Volleyball Team · CUSB".

### Home
1. **Watermark**: logo in grayscale, opacity .06, absolute top-right `right:-18vw; top:-10vw; width:clamp(420px,70vw,900px)`.
2. **Hero** (flex wrap, gap clamp(24,5vw,56)): logo `clamp(140px,30vw,260px)` con `drop-shadow(0 12px 40px rgba(212,174,98,.18))`; kicker "VOLLEYBALL TEAM · CUSB" BC 600 15px ls .32em oro; H1 "CUS**BROS**" BC 800 `clamp(76px,18vw,200px)` lh .85 uppercase ("BROS" oro); "Stagione 2026/27" 16px `#a39e93`.
3. **Prossima partita** card: border `#2c2922`, bg gradient `#151412→#0f0f10`, radius 14, barra oro 4px in alto. Riga: "PROSSIMA PARTITA" (oro, BC 700 15px ls .24em) ↔ "4ª giornata · Trasferta" (`#a39e93`, nowrap). Grid 3 col: casa | "VS" `#6f6a60` | ospite, nomi BC 700 `clamp(26px,6vw,56px)` uppercase, **CUSBros sempre oro**. Data/ora + palestra. **Countdown** 4 celle (Giorni/Ore/Min/Sec) in grid con gap 1px su `#2c2922` (effetto linee), max-w 560, numeri BC 700 `clamp(32px,8vw,52px)` tabular, aggiornamento ogni 1s (client component).
4. Grid `auto-fit minmax(min(100%,340px),1fr)` gap 20:
   - **Ultimo risultato**: card `#121212` border `#2c2922` r14. Score "3–0" BC 800 `clamp(56,12vw,76)`; avversario; badge "V" (bg oro, testo nero) o "P"; chip parziali (bg `#1c1b18`, border `#2c2922`, r6, BC 600 17px).
   - **Classifica** top 5: righe grid `30px 1fr auto`, padding 11/12, r8; riga CUSBros bg oro testo `#0b0b0c` bold. Link "Completa →" → `/calendario#classifica`.
5. CTA "CALENDARIO E RISULTATI →": bg oro, testo nero, r8, min-h 52, BC 700 18px ls .12em; hover `#e6c682`, active `#b8924a`.

### Calendario
- Header: kicker "STAGIONE 2026/27 · ANDATA", H1 "CALENDARIO" BC 800 `clamp(56px,13vw,120px)`.
- **Riepilogo** 4 celle (grid gap 1px): posizione (oro), punti, vinte–perse, set vinti–persi. Numeri BC 800 44px, label 12px ls .14em `#a39e93`.
- **Filtro** segmentato (Tutte / Giocate / Da giocare): container border `#2c2922` r10 p4; attivo bg oro testo nero; min-h 44.
- **Card partita**: border `#2c2922` (prossima: oro + badge "PROSSIMA"), bg `#121212`, r12. Meta: "Nª · Sab 31 ott", "CASA" (blu `#7f9fe0`) / "TRASFERTA" (`#a39e93`). Squadre BC 700 `clamp(20,4vw,26)` con CUSBros oro. Giocata: chip parziali (set vinto border `#5a4b2c` testo oro; perso border `#2c2922` testo `#a39e93`) + a destra score BC 800 `clamp(36,8vw,48)` + "VINTA"/"PERSA" (oro / grigio). Da giocare: ora · palestra + box data 64×64 r10.
- **Classifica** completa: colonne # | Squadra | Pt | G | V | P | Set, `min-width:380px` con scroll orizzontale nel contenitore su mobile; riga CUSBros oro.
- Card partita giocata → link a `/partite/[id]` (riepilogo pubblico).

### Admin — shell comune
Header sticky bg `#0b0b0c` border-bottom `#1f1d19`: logo 32 + "CUSBROS" + "STAFF" (oro, 13px ls .2em) … nome utente · ruolo (13px `#a39e93`) + "Esci". Sotto, tab scrollabili orizzontali: Partite / Giocatori / Live / Storico live — BC 16px ls .1em uppercase, padding 12/10, attivo oro con border-bottom 2px oro. Contenuto max-w 1100 (Live 1200).
Input: bg `#121212`, border `#2c2922` → focus oro, r8, min-h 48–52, 16–17px (≥16px per evitare zoom iOS), `color-scheme: dark` per date/time/select.
Bottone primario: oro/nero r8 min-h 48 BC 700. Secondario: outline `#3a352b`. Distruttivo: testo `#e08a7c`.

### Admin Login
Centrato, max-w 400. Logo 72, kicker "AREA STAFF", H1 "ACCEDI" BC 800 48px. Campi Email, Password; bottone "ENTRA" min-h 54; link "Password dimenticata?" (per ora: mostra "contatta l'admin"). Testo nota 13px `#6f6a60`. Errore credenziali: messaggio sotto i campi in `#e08a7c`.

### Admin Partite
Titolo + "+ NUOVA PARTITA". Lista card: box data 56×56 | "CUSBros vs X" / "X vs CUSBros" + "Nª · Casa · 20:30" o "· 3–1 · Vinta" | bottone "Modifica"/"Chiudi". Card aperta (border oro) espande form: Data, Ora, Avversario (select/creatable), Campo (segmentato Casa/Trasferta), Palestra, **Parziali** 5 slot `noi – loro` (input numerici, noi in oro), azioni Salva / Annulla / Elimina (con conferma). Nota: i parziali si compilano da soli se la partita è registrata dal Live. Salvare → `revalidate` delle pagine pubbliche.
Aggiungere anche gestione **classifica** (tabella editabile) in questa sezione o sotto-tab.

### Admin Giocatori
Layout 2 colonne `auto-fit minmax(min(100%,320px),1fr)`; su mobile la scheda va sotto la lista (o meglio: tap su riga → pagina/drawer dettaglio).
- **Lista**: righe numero (BC 800 28px oro) | nome + ruolo | "★ N" oro + "3/3 pres.". Selezionata: border oro bg `#1a1813`. "+ GIOCATORE" apre form (numero, nome, cognome, ruolo, attivo).
- **Scheda**: numero BC 800 76px oro, nome BC 700 30px, ruolo; 3 celle Presenze / Stelline / MVP; **Efficienza per fondamentale** (solo fondamentali del ruolo: P → alzata/battuta/muro; S → attacco/ricezione/battuta/muro; O → attacco/battuta/muro; C → attacco/muro/battuta; L → ricezione) con % e dettaglio conteggi; **Andamento** grafico linea oro 3px su viewBox 640×240, punti cerchio r5 fill nero stroke oro, griglia 0/50/100%, separatore tratteggiato tra stagioni, tab fondamentale.

### Admin Live (il più importante)
Layout `auto-fit minmax(min(100%,380px),1fr)`: su telefono una colonna (tabellone → modalità → input → campo → azioni), su tablet/desktop due colonne (input | campo + feed).
- **Tabellone**: CUSBros (oro) | "SET n" + set "1–1" | avversario. Punteggio BC 800 `clamp(64px,18vw,88px)` tabular. Pallino 8px accanto a chi batte.
- **Toggle Semplice / Avanzato** (segmentato grid 2 col, min-h 46).
- **Semplice**: due bottoni grandi (min-h 150): "+1 CUSBROS" (oro pieno) e "+1 [AVV]" (outline). Il punto si conta **subito**; poi compare un pannello opzionale:
  - Punto nostro → "Come è arrivato?": Ace / Attacco / Muro / Errore avversario. Errore avv. → "Palla semplice" / "Azione". Gli altri → griglia 3 col dei 6 in campo (numero + cognome, min-h 68) + toggle pill "★ Meritevole".
  - Punto loro → Punto avversario / Errore battuta / Errore attacco / Ricezione errata (include libero) / Fallo-invasione → giocatore.
  - "Salta" chiude: l'evento resta `incomplete=true` (tag rosso "da completare" nel feed, poi sistemabile nello Storico).
- **Avanzato**: tocco giocatore in campo (o libero) → fondamentale (griglia 3×2: Battuta, Ricezione, Alzata, Attacco, Muro, Fallo; attivo oro) → esito (griglia 2 col, min-h 64; esito che dà punto a noi = oro pieno con sub "+1 CUSBros"; punto loro = testo rosso bordo `#5a2f29` sub "+1 Avv"; neutro = sub "continua"). Toggle ★. In fondo "PUNTO AVV" / "ERRORE AVV" per punti senza nostro giocatore. Dopo l'esito il giocatore si deseleziona.
- **Campo**: linea 3px `#cfc9bd` = rete in alto; griglia 3×2 ordine visivo P4 P3 P2 / P5 P6 P1; label "P1…P6", numero oro, cognome; pallino oro su P1 quando battiamo. Libero sotto (bordo tratteggiato, label blu "LIBERO").
  - **Rotazione automatica**: quando facciamo punto mentre batteva l'avversario (cambio palla), ruotare in senso orario (`pos = pos.map((_,i)=>pos[(i+1)%6])`). Bottone "Ruota" manuale.
  - **Cambio n/6**: entra in modalità cambio (bottone oro) → tocca chi esce in campo → tocca chi entra dalla panchina. Registra evento `sub`. Limite 6 per set (avviso, non blocco).
- **Fine set**: quando un team raggiunge 25 (15 al 5°) con +2 → banner bordo oro "Set N vinto/perso X–Y" + "CHIUDI SET" (scrive `match_sets`, azzera punteggio e cambi, chiede formazione set successivo). A 3 set vinti → fine partita, `status=finished`, scelta MVP, riepilogo pubblico.
- **Ultime azioni**: feed (score colorato oro se nostro, testo, ★ o "da completare") + "↶ Annulla" (undo ultimo evento, stack illimitato nel set).
- Prima del live: vedi **Admin Prepara Live** sotto.
- Indicatore stato connessione nel header Live: "Offline · N azioni in coda" / "Sincronizzato".

### Riepilogo partita pubblico (`Partita.dc.html`)
Max-w 1000, nav con "← Calendario".
- Meta: "3ª giornata · Finale" (oro) + data · palestra.
- Score grande: grid 3 col; nome squadra BC 700 `clamp(20,4.5vw,36)`, set vinti BC 800 `clamp(88px,24vw,180px)` lh .8; noi oro, avversario `#6f6a60` se perdente; badge centrale "VINTA"/"PERSA".
- Parziali: celle in grid gap 1px (Set N, "25–18" con nostro punteggio oro).
- **MVP**: card border `#5a4b2c`, gradient `#1a1813→#121212`; numero BC 800 `clamp(72,16vw,112)` oro, "MVP DELLA PARTITA", nome, riga stats.
- **Come abbiamo fatto punto**: barra pill 14px divisa per tipo (attacco `#d4ae62`, muro `#e6c682`, ace `#7f9fe0`, errori avv. `#6f6a60`) + tile con conteggi.
- **I migliori**: 4 card (Attacco, Muro, Battuta, Ricezione) con numero maglia, nome, valore.
- **Squadra a confronto**: righe noi | metrica | loro con doppia barra proporzionale (oro vs `#3a352b`). Metriche avversarie derivate dagli eventi (opp_point, opp_error, ecc.).
Pubblicato quando `status=finished`.

### Admin Prepara Live (`Admin Prepara Live.dc.html`)
Wizard 3 step con progress (3 barre 4px, oro fino allo step corrente; step cliccabili). Barra azioni fissa in basso: "Indietro" + primario (disabilitato `#2c2922` finché non valido).
1. **Presenti**: griglia `auto-fill minmax(160px,1fr)` di card giocatore con checkbox oro; contatore "N/12". Minimo 6. → salva `match_players`.
2. **Formazione set 1**: campo P4 P3 P2 / P5 P6 P1 (rete in alto); slot attivo bordo oro, vuoto tratteggiato "+". Tocca slot, poi tocca un presente (chip; quelli usati opacità .45 con tag P#/L); auto-avanza allo slot vuoto successivo. Slot Libero separato (tratteggiato, label blu). "Usa formazione ultima partita". Primario mostra "Mancano N in campo".
3. **Inizio**: chi batte per primo (CUSBros/avversario), modalità di partenza (Semplice "Punto + tipo + chi" / Avanzato "Ogni tocco della squadra"), card riepilogo. "INIZIA PARTITA" → crea `lineups`, `status=live`, apre il Live.
Banner in alto: pallino verde `#7fbf8a` "Dati salvati sul telefono: il live funziona anche senza rete." — qui il client precarica rosa, partita e formazione in IndexedDB.

### Admin Storico live
Tab orizzontali partita (card min-h 64, attiva bordo oro), segmentato Set 1..n, conteggio azioni, "+ Aggiungi azione". Lista eventi (più recenti in alto): score | "Fondamentale · Esito" + giocatore | tag (★ / +1 noi / +1 loro) + chevron. Riga aperta: select Giocatore / Fondamentale / Esito, toggle ★, Elimina (rosso), Salva. Modificare un evento ricalcola punteggi successivi e statistiche. Filtro rapido "da completare".

## Scorciatoie admin (operazioni ripetitive)
- **Prepara Live · Presenti**: chip "Tutti", "Nessuno", "Come ultima partita".
- **Prepara Live · Formazione**: "Come ultima partita", "Riempi in ordine" (riempie gli slot vuoti seguendo l'ordine di ruolo P, S, C, O, S, C a partire da P1 e assegna il libero se manca), "Svuota".
- **Partite**: chip orari frequenti (18:00 / 20:30 / 21:00, poi calcolati dai più usati); autocompletamento palestra dalle precedenti (`datalist`); "Usa PalaCUS, Bologna" se in casa; "Duplica come ritorno" (crea la partita con casa/trasferta invertite, stesso avversario, data vuota, e la apre).
- **Live · semplice**: nella scelta del giocatore viene evidenziato (bordo `#5a4b2c`, tag "ultimo") l'ultimo giocatore usato per quel tipo di punto.
- **Storico**: filtri "Tutte" / "Da completare · N" (rosso se N>0) / "Solo ★"; "Salva e prossima →" salva e apre l'azione successiva (con il filtro "Da completare" apre la prossima incompleta).

## Offline (Live)
- Ogni evento ha `id` uuid generato dal client e `seq` locale → upsert idempotente lato server (`POST /api/matches/[id]/events` batch).
- Scrivere prima su IndexedDB, UI ottimistica; sync in background (`online` event + retry). Undo offline = evento di cancellazione/flag `deleted`.
- Service worker: precache shell `/admin/live/*`, font, logo. Prima della partita la pagina va aperta online una volta (carica rosa, formazione, partita).
- Sessione: JWT con scadenza lunga (es. 30 giorni) per non perdere il login in palestra.

## Design Tokens
```
--bg            #0b0b0c   sfondo
--surface       #121212   card
--surface-2     #0f0f10   card interna / input pannelli
--surface-sel   #1a1813   selezionato
--surface-hover #161512
--chip          #1c1b18
--line          #2c2922   bordi
--line-strong   #3a352b   bordi bottoni outline
--line-soft     #1f1d19   divisori header/footer
--ink           #f3efe6   testo
--ink-2         #cfc9bd   testo secondario chiaro
--muted         #a39e93   label
--faint         #6f6a60   note, "vs"
--gold          #d4ae62   accento (maglia)
--gold-hover    #e6c682
--gold-active   #b8924a
--gold-line     #5a4b2c   bordo oro attenuato
--blue          #7f9fe0   "Casa", libero (dal blu del logo)
--red           #e08a7c   errori/negativo
--red-line      #5a2f29
```
Radius: 4 (badge), 6 (chip/bottoni nav), 7–8 (bottoni, input, righe), 10 (tile), 12 (card partita), 14 (card grandi), 999 (pill ★).
Tipografia: titoli/numeri/label/bottoni **Barlow Condensed** uppercase con letter-spacing .06–.32em; corpo **Barlow** 13–17px. Numeri sempre `tabular-nums`.
Focus: `outline 2px solid #d4ae62; offset 3px`. Hit target minimo 44px.

## Assets
- `public/logo.png` — logo tondo ritagliato (582×582, sfondo trasparente fuori dal cerchio). Sostituire con PNG/SVG originale se disponibile. Usarlo anche per favicon e icone PWA (192/512).

## Files
`design/` — Home, Calendario, Admin Login, Admin Partite, Admin Giocatori, Admin Live, Admin Storico (`.dc.html`) + `support.js` + `assets/logo.png`.

## Ordine di lavoro suggerito
1. Setup Next + Tailwind + font + token, layout pubblico, Home e Calendario con dati seed.
2. Neon + Drizzle schema + seed (rosa, calendario, classifica). Auth.js + middleware + Login.
3. Admin Partite (CRUD + revalidate). Admin Giocatori (CRUD rosa).
4. Live online (eventi, rotazione, cambi, fine set, undo). Poi offline (IndexedDB + SW + sync).
5. Storico live. Statistiche/efficienza/andamento. Riepilogo pubblico `/partite/[id]`.
6. PWA manifest, deploy Vercel, env (`DATABASE_URL`, `AUTH_SECRET`).
