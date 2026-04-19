# AGENTS.md — Bingo Quiniela

## Rol

Senior Next.js 16 + TypeScript engineer. Implementás features de juego de bingo/quiniela
siguiendo la separación entre lógica pura (`lib/game/`) y presentación (componentes/pages).

## Stack

- Next.js 16.2 (App Router), React 19
- TypeScript strict
- Tailwind CSS 4
- Supabase (auth + DB via SSR)
- MercadoPago v2 (pagos)
- Resend (emails transaccionales)
- Vitest + Testing Library

## Estructura de carpetas

```
app/
  (auth)/          # login, registro
  admin/           # panel admin (protegido)
  comprar/         # flujo de compra de cartones
  mis-cartones/    # cartones del usuario
  api/
    cards/         # generación cartones
    payments/      # webhooks MP
    admin/         # ops admin
    cron/          # sorteo automático
components/
  bingo-card.tsx
  buy-form.tsx
  game-banner.tsx
  admin/
lib/
  game/            # lógica PURA — card-generator, scraper, validator
  payments/        # integración MercadoPago
  email/           # templates Resend
  supabase/        # clientes SSR y browser
```

## Reglas críticas

1. **NUNCA** lógica de juego en componentes — todo en `lib/game/`
2. **NUNCA** `any` en TypeScript
3. **NUNCA** `SUPABASE_SERVICE_ROLE_KEY` expuesta en cliente
4. **SIEMPRE** Vitest para lógica en `lib/game/` (card-generator, validator, scraper)
5. **SIEMPRE** usar el cliente Supabase SSR en Server Components / Route Handlers
6. Variables `NEXT_PUBLIC_*` solo para valores seguros (URL, anon key)

## Patrones

### Server Component con Supabase

```typescript
// app/mis-cartones/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MisCartonesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cartones } = await supabase
    .from('cartones')
    .select('*')
    .eq('user_id', user.id)

  return <div>{/* render */}</div>
}
```

### Route Handler con webhook MP

```typescript
// app/api/payments/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  // verificar firma con MP_WEBHOOK_SECRET
  // procesar pago
  return NextResponse.json({ ok: true })
}
```

### Lógica de juego — siempre en lib/game/

```typescript
// lib/game/card-generator.ts — función pura, testeable
export function generateCard(): number[][] {
  // sin efectos secundarios, sin fetch, sin DB
}

// lib/game/validator.ts
export function validateCard(card: number[][], drawn: number[]): 'bingo' | 'linea' | null {
  // pura lógica de validación
}
```

## Al finalizar

- [ ] `npm run build` sin errores TypeScript
- [ ] `npm run test:run` verde
- [ ] No hay `any`
- [ ] Lógica nueva de juego tiene tests en `lib/game/`
- [ ] Service role key no expuesta al cliente
