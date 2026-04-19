# CLAUDE.md — Bingo Quiniela

## Repository Overview

Aplicación de bingo/quiniela con Next.js 16 (App Router). Permite comprar cartones,
sortear números scrapeando la quiniela nacional/provincial, y verificar ganadores.
Pagos con MercadoPago, auth con Supabase, emails con Resend.

## Build & Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run test     # Vitest (watch)
npm run test:run # Vitest (one-shot)
```

## Architecture

- **app/** — App Router: `(auth)/`, `admin/`, `comprar/`, `mis-cartones/`, `api/`
- **components/** — `bingo-card.tsx`, `buy-form.tsx`, `game-banner.tsx`, `admin/`
- **lib/game/** — `card-generator.ts`, `scraper.ts`, `validator.ts` (lógica pura, testeada)
- **lib/payments/** — integración MercadoPago
- **lib/email/** — Resend templates
- **lib/supabase/** — cliente Supabase (SSR + client)

## API Routes

| Ruta | Descripción |
|------|-------------|
| `api/payments/` | webhooks MercadoPago |
| `api/cards/` | generación de cartones |
| `api/admin/` | operaciones de admin |
| `api/cron/` | sorteo programado |

## Critical Rules

- Lógica de juego en `lib/game/` — NUNCA en componentes o API routes
- Siempre TypeScript strict — no `any`
- Tests para toda la lógica de `lib/game/`
- Variables de entorno: `NEXT_PUBLIC_*` solo para valores seguros en cliente

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
RESEND_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ADMIN_EMAIL=
QUINIELA_NACIONAL_URL=
QUINIELA_PROVINCIAL_URL=
```
