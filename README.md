# CUSBros

Web app della squadra di pallavolo mista **CUSBros** (CUSB · Libertas Cup Mix 2027, girone Challenge, Rimini): sito pubblico (home, calendario, classifica, riepilogo di ogni partita giocata) e area staff (partite, classifica, giocatori con statistiche e andamento, Live per registrare le partite anche offline, Storico per correggerle). Online su https://volley-squad.vercel.app (staff: `/admin`); si installa come app sul telefono.

Specifica completa e prototipi: [`design_handoff_cusbros/`](design_handoff_cusbros/README.md) (i dati dei prototipi sono inventati). Avanzamento lavori e decisioni: [`docs/ROADMAP.md`](docs/ROADMAP.md). Architettura, convenzioni e regole di lavoro: [`CLAUDE.md`](CLAUDE.md).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Neon Postgres + Drizzle ORM · Auth.js v5 · Vercel.

## Avvio in locale

Requisiti: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env.local   # (o .env) poi compila DATABASE_URL e AUTH_SECRET
npm run db:migrate           # crea le tabelle su Neon
npm run db:seed              # calendario reale, classifica e rosa (solo su DB vuoto)
npm run user:create -- tua@email.it "Nome Cognome" admin   # chiede la password
npm run dev                  # http://localhost:3001
```

Area staff: http://localhost:3001/admin (non linkata dal sito pubblico).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo (Turbopack) su http://localhost:3001 |
| `npm run build` | build di produzione (serve il DB raggiungibile) |
| `npm run start` | avvia la build di produzione (porta 3001) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | controllo dei tipi TypeScript |
| `npm run db:generate` | genera una migrazione SQL da `src/db/schema.ts` |
| `npm run db:migrate` | applica le migrazioni al DB |
| `npm run db:studio` | interfaccia web per vedere/modificare i dati |
| `npm run db:seed` | carica stagione, calendario, classifica e rosa iniziali (non tocca un DB già popolato) |
| `npm run user:create -- <email> "<nome>" <admin\|coach>` | crea un utente staff o ne aggiorna nome/ruolo/password |
| `npm test` | test della logica (Live, Storico, statistiche, riepilogo partita, validazioni, date, formazione, redirect del login): pochi secondi, non usa il DB |
| `npm run test:e2e` | E2E Playwright sul **DB reale** (Live completo → Storico → riepilogo pubblico, offline, invio, sicurezza), con copia e ripristino verificato (vedi sotto) |
| `npm run test:restore` | dopo un E2E interrotto: mostra le differenze dalla copia; con `-- --apply` ripristina |
| `npm run test:manual` | prova a mano sul DB reale (es. dal telefono): copia del DB + partita "Prova telefono"; si chiude con `test:restore` |

Modificare lo schema: cambia `src/db/schema.ts` → `npm run db:generate` → controlla l'SQL in `drizzle/` → `npm run db:migrate`.

## Test

- **Logica** (`tests/unit/`, runner integrato di Node via `tsx`): `npm test`.
- **E2E** (`tests/e2e/`, Playwright, Chromium a 390×844): serve il dev server già avviato (`npm run dev`, porta 3001); per un'altra porta `E2E_BASE_URL=http://localhost:<porta> npm run test:e2e`. La prima volta: `npx playwright install chromium`.
  - Prima del test si copiano le tabelle (anche su file in `tests/.snapshots/`, ignorato da git), si crea un utente temporaneo e una **partita temporanea** (le partite vere non si toccano).
  - Alla fine, anche se il test fallisce, il DB torna identico alla copia, si verifica rileggendo tutto e il file si elimina. Se il ripristino non è identico il comando fallisce e il file resta.
  - `offline.spec.ts` in sviluppo verifica coda, chiusura dell'app e sincronizzazione; il **service worker** (riapertura del Live senza rete) è attivo solo in produzione: fermare il dev server, `npm run build`, poi `AUTH_TRUST_HOST=true npm start` (stessa porta 3001) e `npm run test:e2e`. In locale `next start` vuole `AUTH_TRUST_HOST=true` (su Vercel non serve).
  - `security.spec.ts`: area staff chiusa senza accesso, API del Live protetta, intestazioni di sicurezza, niente indicizzazione dello staff, stesso messaggio per email o password sbagliate, redirect solo interni, utente eliminato fuori subito. Tocca solo utenti temporanei.
  - **Mai mentre qualcuno usa l'app sul DB reale**: il ripristino riporta il DB a com'era alla partenza e cancellerebbe le sue azioni.
  - Mai contro il sito pubblicato: le pagine pubbliche in cache potrebbero mostrare per qualche minuto la partita temporanea.
  - Se il test si interrompe a metà, il successivo non parte finché c'è un file di copia: `npm run test:restore` mostra le differenze, `npm run test:restore -- --apply` ripristina. Attenzione: riporta le tabelle a com'erano prima del test, annullando anche modifiche fatte dopo.

## Deploy

Vercel, collegato al repo: ogni push su `main` va online (https://volley-squad.vercel.app). Variabili su Vercel: `DATABASE_URL`, `AUTH_SECRET`. Le funzioni girano in `fra1` (`vercel.json`), vicino al DB Neon (`eu-central-1`).

- **App sul telefono:** dal sito "Aggiungi a Home" installa "CUSBros"; dall'area staff "CUSBros Staff" (apre `/admin`), a schermo intero.
- **Live offline:** aprire il Live **con la rete** prima della partita; poi funziona anche senza, le azioni restano sul telefono e partono al ritorno della rete. Un solo telefono per partita.
- **iPhone:** Safari cancella i dati di un sito non aperto da 7 giorni se non è installato sulla Home: chi registra il Live installi l'app.

## Sicurezza

- Area staff (`/admin/**`) protetta dal middleware; ogni pagina staff, server action e invio del Live ricontrolla sessione **e** che l'utente esista ancora (`src/lib/auth-guard.ts`): eliminando un utente, l'accesso finisce subito.
- Login: password con bcrypt, stesso messaggio e stessi tempi per email sconosciuta o password sbagliata, dopo il login solo redirect interni all'area staff. Sessione di 30 giorni (in palestra non si deve perdere).
- Intestazioni di sicurezza su tutte le pagine (`next.config.ts`): il sito non si può mostrare dentro cornici di altri siti, niente fotocamera/microfono/posizione. L'area staff non viene indicizzata.
- Le azioni di una partita conclusa si correggono solo dallo Storico: l'API del Live le rifiuta.
- Limite ai tentativi di accesso: dopo 5 errori con la stessa email dalla stessa connessione (o 20 da una connessione, 50 sulla stessa email) si aspetta fino a 15 minuti (`src/lib/login-limit.ts`).

## Git

- `main`: versione stabile, deployata.
- `dev`: sviluppo quotidiano; si fa merge su `main` a step completato.
- `feat/xxx`: solo per lavori grossi, partono da `dev` e tornano su `dev`.

## Variabili d'ambiente

Solo in `.env.local` o `.env` (mai committati). Vedi [`.env.example`](.env.example): `DATABASE_URL`, `AUTH_SECRET`.
