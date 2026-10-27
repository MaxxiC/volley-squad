# CUSBros

Web app della squadra di pallavolo **CUSBros** (CUSB): sito pubblico (home, calendario, risultati) e area staff (partite, giocatori, live, storico).

Specifica completa e prototipi: [`design_handoff_cusbros/`](design_handoff_cusbros/README.md). Avanzamento lavori: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Neon Postgres + Drizzle ORM · Auth.js v5 · Vercel.

## Avvio in locale

Requisiti: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env.local   # poi compila DATABASE_URL e AUTH_SECRET
npm run db:migrate           # crea le tabelle su Neon
npm run db:seed              # dati di esempio (solo su DB vuoto)
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
| `npm run db:generate` | genera una migrazione SQL da `src/db/schema.ts` |
| `npm run db:migrate` | applica le migrazioni al DB |
| `npm run db:studio` | interfaccia web per vedere/modificare i dati |
| `npm run db:seed` | carica i dati di esempio (non tocca un DB già popolato) |
| `npm run user:create -- <email> "<nome>" <admin\|coach>` | crea un utente staff o ne aggiorna nome/ruolo/password |

Modificare lo schema: cambia `src/db/schema.ts` → `npm run db:generate` → controlla l'SQL in `drizzle/` → `npm run db:migrate`.

## Git

- `main`: versione stabile, deployata.
- `dev`: sviluppo quotidiano; si fa merge su `main` a step completato.
- `feat/xxx`: solo per lavori grossi, partono da `dev` e tornano su `dev`.

## Variabili d'ambiente

Solo in `.env.local` (mai committato). Vedi [`.env.example`](.env.example): `DATABASE_URL`, `AUTH_SECRET`.
