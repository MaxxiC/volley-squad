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
npm run dev                  # http://localhost:3000
```

Area staff: http://localhost:3000/admin (non linkata dal sito pubblico).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo (Turbopack) |
| `npm run build` | build di produzione (serve il DB raggiungibile) |
| `npm run start` | avvia la build di produzione |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | controllo dei tipi TypeScript |
| `npm run db:generate` | genera una migrazione SQL da `src/db/schema.ts` |
| `npm run db:migrate` | applica le migrazioni al DB |
| `npm run db:studio` | interfaccia web per vedere/modificare i dati |
| `npm run db:seed` | carica stagione, calendario, classifica e rosa iniziali (non tocca un DB già popolato) |
| `npm run user:create -- <email> "<nome>" <admin\|coach>` | crea un utente staff o ne aggiorna nome/ruolo/password |

Modificare lo schema: cambia `src/db/schema.ts` → `npm run db:generate` → controlla l'SQL in `drizzle/` → `npm run db:migrate`.

## Git

- `main`: versione stabile, deployata.
- `dev`: sviluppo quotidiano; si fa merge su `main` a step completato.
- `feat/xxx`: solo per lavori grossi, partono da `dev` e tornano su `dev`.

## Variabili d'ambiente

Solo in `.env.local` o `.env` (mai committati). Vedi [`.env.example`](.env.example): `DATABASE_URL`, `AUTH_SECRET`.
