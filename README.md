# CUSBros

Web app della squadra di pallavolo **CUSBros** (CUSB): sito pubblico (home, calendario, risultati) e area staff (partite, giocatori, live, storico).

Specifica completa e prototipi: [`design_handoff_cusbros/`](design_handoff_cusbros/README.md). Avanzamento lavori: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Neon Postgres + Drizzle ORM · Auth.js v5 · Vercel.

## Avvio in locale

Requisiti: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env.local   # poi compila i valori
npm run dev                  # http://localhost:3000
```

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo (Turbopack) |
| `npm run build` | build di produzione |
| `npm run start` | avvia la build di produzione |
| `npm run lint` | ESLint |

## Git

- `main`: versione stabile, deployata.
- `dev`: sviluppo quotidiano; si fa merge su `main` a step completato.
- `feat/xxx`: solo per lavori grossi, partono da `dev` e tornano su `dev`.

## Variabili d'ambiente

Solo in `.env.local` (mai committato). Vedi [`.env.example`](.env.example): `DATABASE_URL`, `AUTH_SECRET`.
