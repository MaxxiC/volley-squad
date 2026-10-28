# CUSBros

Web app della squadra di pallavolo mista **CUSBros** (CUSB · Libertas Cup Mix 2027, girone Challenge, Rimini): sito pubblico (home, calendario, risultati, classifica) e area staff (partite, classifica, giocatori, live, storico).

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
| `npm test` | test della logica (Live, validazioni, date, formazione): pochi secondi, non usa il DB |
| `npm run test:e2e` | E2E Playwright del Live sul **DB reale**, con copia e ripristino verificato (vedi sotto) |
| `npm run test:restore` | dopo un E2E interrotto: mostra le differenze dalla copia; con `-- --apply` ripristina |

Modificare lo schema: cambia `src/db/schema.ts` → `npm run db:generate` → controlla l'SQL in `drizzle/` → `npm run db:migrate`.

## Test

- **Logica** (`tests/unit/`, runner integrato di Node via `tsx`): `npm test`.
- **E2E** (`tests/e2e/`, Playwright, Chromium a 390×844): serve il dev server già avviato (`npm run dev`, porta 3001); per un'altra porta `E2E_BASE_URL=http://localhost:<porta> npm run test:e2e`. La prima volta: `npx playwright install chromium`.
  - Prima del test si copiano le tabelle (anche su file in `tests/.snapshots/`, ignorato da git), si crea un utente temporaneo e una **partita temporanea** (le partite vere non si toccano).
  - Alla fine, anche se il test fallisce, il DB torna identico alla copia, si verifica rileggendo tutto e il file si elimina. Se il ripristino non è identico il comando fallisce e il file resta.
  - `offline.spec.ts` in sviluppo verifica coda, chiusura dell'app e sincronizzazione; il **service worker** (riapertura del Live senza rete) è attivo solo in produzione: fermare il dev server, `npm run build`, poi `AUTH_TRUST_HOST=true npm start` (stessa porta 3001) e `npm run test:e2e`. In locale `next start` vuole `AUTH_TRUST_HOST=true` (su Vercel non serve).
  - Mai contro il sito pubblicato: le pagine pubbliche in cache potrebbero mostrare per qualche minuto la partita temporanea.
  - Se il test si interrompe a metà, il successivo non parte finché c'è un file di copia: `npm run test:restore` mostra le differenze, `npm run test:restore -- --apply` ripristina. Attenzione: riporta le tabelle a com'erano prima del test, annullando anche modifiche fatte dopo.

## Git

- `main`: versione stabile, deployata.
- `dev`: sviluppo quotidiano; si fa merge su `main` a step completato.
- `feat/xxx`: solo per lavori grossi, partono da `dev` e tornano su `dev`.

## Variabili d'ambiente

Solo in `.env.local` o `.env` (mai committati). Vedi [`.env.example`](.env.example): `DATABASE_URL`, `AUTH_SECRET`.
