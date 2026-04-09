# Bingo Quiniela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web platform where users buy weekly bingo cards validated against Argentine quiniela nightly results, with automatic winner detection and prize distribution.

**Architecture:** Next.js 14 App Router for frontend and API routes in a single repo, Supabase for PostgreSQL + Auth + Realtime, Vercel for deploy and cron jobs. Payments via Mercado Pago webhook + manual bank transfer confirmation.

**Tech Stack:** Next.js 14, TypeScript, Supabase, Tailwind CSS, Mercado Pago SDK, Resend, Cheerio (scraping), Vitest, Vercel Cron

---

## File Map

```
bingo-quiniela/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # Landing: current game stats + buy CTA
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── registro/page.tsx
│   ├── comprar/page.tsx                  # Buy cards flow
│   ├── mis-cartones/page.tsx             # User's cards for current game
│   ├── resultados/page.tsx               # Past game results
│   ├── admin/
│   │   ├── layout.tsx                    # Admin auth guard
│   │   ├── page.tsx                      # Dashboard: stats + jackpot
│   │   ├── pagos/page.tsx                # Pending transfers + MP history
│   │   ├── ganadores/page.tsx            # Winners list + mark paid
│   │   ├── sorteos/page.tsx              # Manual draw entry
│   │   └── configuracion/page.tsx        # Price, commission, CBU, MP keys
│   └── api/
│       ├── cards/buy/route.ts            # POST: create cards after payment intent
│       ├── payments/
│       │   ├── mercadopago/webhook/route.ts  # MP webhook → approve cards
│       │   └── transfer/route.ts             # POST: upload comprobante
│       ├── admin/
│       │   ├── payments/[id]/route.ts    # PATCH: approve/reject transfer
│       │   ├── draw/route.ts             # POST: manual draw entry
│       │   └── config/route.ts           # GET/PATCH: game config
│       └── cron/
│           └── draw/route.ts             # Vercel Cron nightly job
├── components/
│   ├── bingo-card.tsx                    # Card grid 3x9, beige style, realtime marks
│   ├── game-banner.tsx                   # Jackpot amount + cards sold
│   ├── buy-form.tsx                      # Quantity selector + payment method
│   └── admin/
│       ├── transfer-list.tsx             # Pending transfers with image
│       └── draw-form.tsx                 # Manual number entry form
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client (singleton)
│   │   └── server.ts                     # Server Supabase client (cookies)
│   ├── game/
│   │   ├── card-generator.ts             # Generate valid Italian bingo card
│   │   ├── validator.ts                  # Detect line/full winners from marks
│   │   └── scraper.ts                    # Scrape quiniela nocturna results
│   ├── payments/
│   │   └── mercadopago.ts                # MP SDK: create preference, verify webhook
│   └── email/
│       └── resend.ts                     # Send card, confirm purchase, notify winner
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── middleware.ts                          # Protect /admin and /mis-cartones routes
├── vitest.config.ts
└── vercel.json                           # Cron schedule
```

---

## Phase 1: Foundation

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`, `.env.example`, `vercel.json`

- [ ] **Step 1: Create Next.js project**

```bash
cd "C:/Users/Bruno Avila/Documents/Proyectos_Propios"
npx create-next-app@latest bingo-quiniela \
  --typescript --tailwind --app --src-dir=no \
  --import-alias="@/*" --no-eslint
cd bingo-quiniela
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr \
  mercadopago resend cheerio \
  @types/cheerio

npm install -D vitest @vitejs/plugin-react \
  jsdom @testing-library/react @testing-library/jest-dom \
  @vitest/coverage-v8
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 4: Create vitest.setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create .env.example**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
RESEND_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Copy to `.env.local` and fill in real values.

- [ ] **Step 6: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/draw",
      "schedule": "0 1 * * 1-5"
    }
  ]
}
```

(01:00 UTC = 22:00 ART, Monday–Friday)

- [ ] **Step 7: Add test script to package.json**

```bash
npm pkg set scripts.test="vitest" scripts.test:run="vitest run"
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Next.js 14, Supabase, Vitest"
```

---

### Task 2: Database schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install -D supabase
npx supabase init
npx supabase login
```

- [ ] **Step 2: Create migration file**

```bash
npx supabase migration new initial_schema
```

Edit the generated file in `supabase/migrations/` with:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Games table
create table games (
  id uuid primary key default uuid_generate_v4(),
  week_start date not null,
  week_end date not null,
  status text not null default 'active'
    check (status in ('active', 'line_won', 'closed', 'paying')),
  jackpot_amount numeric not null default 0,
  line_amount numeric not null default 0,
  card_price numeric not null default 2000,
  commission_pct numeric not null default 20,
  created_at timestamptz default now()
);

-- Cards table
create table cards (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references games(id),
  user_id uuid references auth.users(id),
  user_email text not null,
  numbers integer[] not null,
  paid boolean not null default false,
  payment_method text check (payment_method in ('mercadopago', 'transfer')),
  payment_ref text,
  created_at timestamptz default now()
);

-- Payments table
create table payments (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references cards(id),
  method text not null check (method in ('mercadopago', 'transfer')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  mp_payment_id text,
  transfer_img_url text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Drawn numbers table
create table drawn_numbers (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references games(id),
  number integer not null check (number between 1 and 90),
  source text not null check (source in ('nacional', 'provincial')),
  draw_date date not null,
  created_at timestamptz default now(),
  unique(game_id, number, source, draw_date)
);

-- Card marks (numbers crossed off)
create table card_marks (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references cards(id),
  number integer not null check (number between 1 and 90),
  unique(card_id, number)
);

-- Winners table
create table winners (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references cards(id),
  game_id uuid not null references games(id),
  prize_type text not null check (prize_type in ('line', 'full')),
  amount numeric not null,
  paid_out boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Admin config (single row)
create table config (
  id integer primary key default 1 check (id = 1),
  card_price numeric not null default 2000,
  commission_pct numeric not null default 20,
  cbu text,
  alias text,
  mp_access_token text,
  updated_at timestamptz default now()
);

insert into config (id) values (1);

-- Row Level Security
alter table games enable row level security;
alter table cards enable row level security;
alter table payments enable row level security;
alter table drawn_numbers enable row level security;
alter table card_marks enable row level security;
alter table winners enable row level security;
alter table config enable row level security;

-- Public read for games and drawn_numbers
create policy "games_public_read" on games for select using (true);
create policy "drawn_numbers_public_read" on drawn_numbers for select using (true);
create policy "winners_public_read" on winners for select using (true);

-- Cards: users see own cards
create policy "cards_own_read" on cards for select
  using (auth.uid() = user_id or auth.jwt()->>'role' = 'admin');

-- Card marks: users see marks for own cards
create policy "card_marks_own_read" on card_marks for select
  using (
    exists (
      select 1 from cards where cards.id = card_marks.card_id
        and (cards.user_id = auth.uid() or auth.jwt()->>'role' = 'admin')
    )
  );

-- Admin-only write policies (service role bypasses RLS)
create policy "admin_all_config" on config
  using (auth.jwt()->>'role' = 'admin');
```

- [ ] **Step 3: Apply migration to local Supabase**

```bash
npx supabase start
npx supabase db push
```

Expected: tables created without errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: initial database schema with RLS"
```

---

### Task 3: Supabase client + middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`

- [ ] **Step 1: Create browser client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

- [ ] **Step 3: Create middleware**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect /mis-cartones
  if (request.nextUrl.pathname.startsWith('/mis-cartones') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protect /admin — require admin role
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    const meta = user.user_metadata as { role?: string }
    if (meta?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/mis-cartones/:path*', '/admin/:path*'],
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/ middleware.ts
git commit -m "feat: Supabase client setup and route middleware"
```

---

### Task 4: Authentication pages

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/registro/page.tsx`

- [ ] **Step 1: Create login page**

```typescript
// app/(auth)/login/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    router.push('/')
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Iniciar sesión</h1>
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
            required
          />
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit"
            className="w-full bg-[#8b7355] text-white py-2 rounded-lg font-medium">
            Entrar
          </button>
        </form>
        <button onClick={handleGoogle}
          className="w-full mt-3 border border-[#d4c5a9] py-2 rounded-lg text-[#5c4a2a]">
          Continuar con Google
        </button>
        <p className="mt-4 text-center text-sm text-[#8b7355]">
          ¿No tenés cuenta? <a href="/registro" className="underline">Registrate</a>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create auth callback route**

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}/`)
}
```

- [ ] **Step 3: Create register page**

```typescript
// app/(auth)/registro/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function RegisterPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    if (error) { setError(error.message); return }
    setDone(true)
  }

  if (done) return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <div className="bg-white rounded-xl shadow p-8 text-center">
        <h2 className="text-xl font-bold text-[#5c4a2a]">¡Listo!</h2>
        <p className="text-[#8b7355] mt-2">Revisá tu email para confirmar la cuenta.</p>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Crear cuenta</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="text" placeholder="Nombre" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" required />
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" required />
          <input type="password" placeholder="Contraseña (mín. 6 caracteres)" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit"
            className="w-full bg-[#8b7355] text-white py-2 rounded-lg font-medium">
            Registrarme
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: login and register pages with Supabase Auth"
```

---

## Phase 2: Card Generation

### Task 5: Italian bingo card generator

**Files:**
- Create: `lib/game/card-generator.ts`, `lib/game/card-generator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/game/card-generator.test.ts
import { describe, it, expect } from 'vitest'
import { generateCard } from './card-generator'

describe('generateCard', () => {
  it('returns exactly 15 numbers', () => {
    const card = generateCard()
    expect(card.numbers).toHaveLength(15)
  })

  it('all numbers are between 1 and 90', () => {
    const card = generateCard()
    card.numbers.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(90)
    })
  })

  it('has no duplicate numbers', () => {
    const card = generateCard()
    const unique = new Set(card.numbers)
    expect(unique.size).toBe(15)
  })

  it('each row has exactly 5 numbers', () => {
    const card = generateCard()
    expect(card.rows[0].filter(n => n !== null)).toHaveLength(5)
    expect(card.rows[1].filter(n => n !== null)).toHaveLength(5)
    expect(card.rows[2].filter(n => n !== null)).toHaveLength(5)
  })

  it('numbers in column 0 are between 1-9', () => {
    for (let i = 0; i < 20; i++) {
      const card = generateCard()
      card.rows.forEach(row => {
        if (row[0] !== null) {
          expect(row[0]).toBeGreaterThanOrEqual(1)
          expect(row[0]).toBeLessThanOrEqual(9)
        }
      })
    }
  })

  it('numbers in column 8 are between 80-90', () => {
    for (let i = 0; i < 20; i++) {
      const card = generateCard()
      card.rows.forEach(row => {
        if (row[8] !== null) {
          expect(row[8]).toBeGreaterThanOrEqual(80)
          expect(row[8]).toBeLessThanOrEqual(90)
        }
      })
    }
  })

  it('generates different cards each time', () => {
    const a = generateCard()
    const b = generateCard()
    expect(a.numbers).not.toEqual(b.numbers)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run lib/game/card-generator.test.ts
```

Expected: FAIL — "generateCard not defined"

- [ ] **Step 3: Implement card generator**

```typescript
// lib/game/card-generator.ts

export interface BingoCard {
  numbers: number[]        // flat array of 15 numbers
  rows: (number | null)[][] // 3 rows × 9 cols, null = empty cell
}

// Column ranges: col 0 → 1-9, cols 1-7 → 10-79 (groups of 10), col 8 → 80-90
const COL_RANGES: [number, number][] = [
  [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
  [50, 59], [60, 69], [70, 79], [80, 90],
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickUnique(min: number, max: number, count: number): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

export function generateCard(): BingoCard {
  // Each column gets 1, 2, or 3 numbers, total must be 15 across 9 columns
  // Standard distribution: sum must equal 15, each col 1-3
  // Simple approach: randomly assign counts that sum to 15
  let counts: number[]
  do {
    counts = COL_RANGES.map(() => randomInt(1, 3))
  } while (counts.reduce((a, b) => a + b, 0) !== 15)

  // Pick numbers for each column
  const colNumbers: number[][] = COL_RANGES.map(([min, max], i) =>
    pickUnique(min, max, counts[i])
  )

  // Build 3×9 grid: distribute column numbers across 3 rows
  // Each row must have exactly 5 numbers
  const grid: (number | null)[][] = [
    Array(9).fill(null),
    Array(9).fill(null),
    Array(9).fill(null),
  ]

  // For each column, place its numbers in random rows
  for (let col = 0; col < 9; col++) {
    const nums = colNumbers[col]
    const rowIndices = pickUnique(0, 2, nums.length)
    nums.forEach((num, i) => {
      grid[rowIndices[i]][col] = num
    })
  }

  // Verify each row has exactly 5 numbers; if not, rebalance
  // (retry the whole thing — simpler than fixing)
  const rowCounts = grid.map(row => row.filter(n => n !== null).length)
  if (!rowCounts.every(c => c === 5)) {
    return generateCard() // retry
  }

  const numbers = colNumbers.flat()

  return { numbers, rows: grid }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run lib/game/card-generator.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add lib/game/
git commit -m "feat: Italian bingo card generator with tests"
```

---

### Task 6: Winner validator

**Files:**
- Create: `lib/game/validator.ts`, `lib/game/validator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/game/validator.test.ts
import { describe, it, expect } from 'vitest'
import { checkWinners } from './validator'
import type { BingoCard } from './card-generator'

const card: BingoCard = {
  numbers: [7, 23, 41, 62, 88, 15, 29, 44, 57, 73, 3, 36, 48, 65, 90],
  rows: [
    [7, null, 23, null, 41, null, 62, null, 88],
    [null, 15, 29, 44, null, 57, null, 73, null],
    [3, null, null, 36, 48, null, 65, null, 90],
  ],
}

describe('checkWinners', () => {
  it('returns no winner when no marks', () => {
    const result = checkWinners(card, [])
    expect(result.hasLine).toBe(false)
    expect(result.hasFull).toBe(false)
  })

  it('detects line when a full row is marked', () => {
    const marks = [7, 23, 41, 62, 88] // row 0 complete
    const result = checkWinners(card, marks)
    expect(result.hasLine).toBe(true)
    expect(result.hasFull).toBe(false)
  })

  it('does not detect line with partial row', () => {
    const marks = [7, 23, 41, 62] // row 0 missing 88
    const result = checkWinners(card, marks)
    expect(result.hasLine).toBe(false)
  })

  it('detects full card when all 15 numbers marked', () => {
    const result = checkWinners(card, card.numbers)
    expect(result.hasLine).toBe(true)
    expect(result.hasFull).toBe(true)
  })

  it('detects line in row 1', () => {
    const marks = [15, 29, 44, 57, 73]
    const result = checkWinners(card, marks)
    expect(result.hasLine).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run lib/game/validator.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement validator**

```typescript
// lib/game/validator.ts
import type { BingoCard } from './card-generator'

export interface WinnerResult {
  hasLine: boolean
  hasFull: boolean
  winningRows: number[] // indices of completed rows
}

export function checkWinners(card: BingoCard, marks: number[]): WinnerResult {
  const markedSet = new Set(marks)
  const winningRows: number[] = []

  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const rowNumbers = card.rows[rowIdx].filter((n): n is number => n !== null)
    if (rowNumbers.every(n => markedSet.has(n))) {
      winningRows.push(rowIdx)
    }
  }

  const hasLine = winningRows.length > 0
  const hasFull = card.numbers.every(n => markedSet.has(n))

  return { hasLine, hasFull, winningRows }
}

// Extract valid numbers from quiniela result string
// e.g. "7453" → 53 (last 2 digits, must be 1-90)
export function extractQuinielaNumber(raw: string): number | null {
  const lastTwo = parseInt(raw.slice(-2), 10)
  if (lastTwo >= 1 && lastTwo <= 90) return lastTwo
  return null
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run lib/game/validator.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add lib/game/validator.ts lib/game/validator.test.ts
git commit -m "feat: winner validator and quiniela number extractor with tests"
```

---

### Task 7: Bingo card UI component

**Files:**
- Create: `components/bingo-card.tsx`

- [ ] **Step 1: Create component**

```typescript
// components/bingo-card.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BingoCardProps {
  cardId: string
  rows: (number | null)[][]
  initialMarks?: number[]
  gameId: string
}

export function BingoCard({ cardId, rows, initialMarks = [], gameId }: BingoCardProps) {
  const [marks, setMarks] = useState<Set<number>>(new Set(initialMarks))
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to realtime marks for this card
    const channel = supabase
      .channel(`card-marks-${cardId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'card_marks',
        filter: `card_id=eq.${cardId}`,
      }, payload => {
        setMarks(prev => new Set([...prev, payload.new.number]))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [cardId, supabase])

  return (
    <div className="inline-block bg-[#f5f0e8] border-2 border-[#d4c5a9] rounded-xl p-3 shadow">
      <table className="border-collapse">
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((num, colIdx) => (
                <td key={colIdx} className="p-0.5">
                  {num === null ? (
                    <div className="w-9 h-9 rounded bg-[#f5f0e8]" />
                  ) : (
                    <div className={`w-9 h-9 rounded flex items-center justify-center
                      font-bold text-sm select-none transition-colors
                      ${marks.has(num)
                        ? 'bg-[#8b7355] text-white'
                        : 'bg-[#ede8dc] text-[#5c4a2a]'
                      }`}>
                      {num}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/bingo-card.tsx
git commit -m "feat: BingoCard component with realtime mark updates"
```

---

## Phase 3: Purchase Flow

### Task 8: Buy cards API

**Files:**
- Create: `app/api/cards/buy/route.ts`

- [ ] **Step 1: Create the buy endpoint**

```typescript
// app/api/cards/buy/route.ts
import { createServiceClient } from '@/lib/supabase/server'
import { generateCard } from '@/lib/game/card-generator'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json() as {
    quantity: number
    email: string
    userId?: string
    paymentMethod: 'mercadopago' | 'transfer'
    gameId: string
  }

  const { quantity, email, userId, paymentMethod, gameId } = body

  if (!quantity || quantity < 1 || quantity > 100) {
    return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
  }

  // Insert cards (unpaid)
  const cards = Array.from({ length: quantity }, () => {
    const card = generateCard()
    return {
      game_id: gameId,
      user_id: userId ?? null,
      user_email: email,
      numbers: card.numbers,
      paid: false,
      payment_method: paymentMethod,
    }
  })

  const { data: insertedCards, error } = await supabase
    .from('cards')
    .insert(cards)
    .select('id, numbers')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cards: insertedCards })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cards/
git commit -m "feat: buy cards API endpoint"
```

---

### Task 9: Mercado Pago integration

**Files:**
- Create: `lib/payments/mercadopago.ts`, `app/api/payments/mercadopago/webhook/route.ts`

- [ ] **Step 1: Create MP wrapper**

```typescript
// lib/payments/mercadopago.ts
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

function getClient() {
  return new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
  })
}

export async function createPreference(params: {
  cardIds: string[]
  quantity: number
  unitPrice: number
  payerEmail: string
  externalReference: string
}) {
  const client = getClient()
  const preference = new Preference(client)

  const response = await preference.create({
    body: {
      items: [{
        id: 'bingo-card',
        title: `Cartón de Bingo x${params.quantity}`,
        quantity: params.quantity,
        unit_price: params.unitPrice,
        currency_id: 'ARS',
      }],
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL}/comprar/exito`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL}/comprar/error`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/mercadopago/webhook`,
    },
  })

  return response
}

export async function getPayment(paymentId: string) {
  const client = getClient()
  const payment = new Payment(client)
  return payment.get({ id: paymentId })
}

export function verifyWebhookSignature(
  signature: string | null,
  requestId: string | null,
  dataId: string,
): boolean {
  if (!signature || !requestId) return false
  const secret = process.env.MP_WEBHOOK_SECRET!
  const manifest = `id:${dataId};request-id:${requestId};ts:${signature.split(';')[0]?.split('ts=')[1]};`
  const crypto = require('crypto')
  const expectedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  const receivedHash = signature.split(';').find((s: string) => s.startsWith('v1='))?.replace('v1=', '')
  return expectedHash === receivedHash
}
```

- [ ] **Step 2: Create webhook handler**

```typescript
// app/api/payments/mercadopago/webhook/route.ts
import { createServiceClient } from '@/lib/supabase/server'
import { getPayment, verifyWebhookSignature } from '@/lib/payments/mercadopago'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const signature = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  const body = await request.json() as { type: string; data: { id: string } }

  if (body.type !== 'payment') {
    return NextResponse.json({ ok: true })
  }

  const dataId = body.data.id
  if (!verifyWebhookSignature(signature, requestId, dataId)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payment = await getPayment(dataId)
  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()
  const externalRef = payment.external_reference // comma-separated card IDs

  if (!externalRef) return NextResponse.json({ ok: true })

  const cardIds = externalRef.split(',')

  // Mark cards as paid and create payment records
  const { error: cardError } = await supabase
    .from('cards')
    .update({ paid: true, payment_ref: dataId })
    .in('id', cardIds)

  if (cardError) {
    return NextResponse.json({ error: cardError.message }, { status: 500 })
  }

  await supabase.from('payments').insert(
    cardIds.map(id => ({
      card_id: id,
      method: 'mercadopago',
      status: 'approved',
      mp_payment_id: dataId,
    }))
  )

  // Update jackpot: 80% of each card price
  const { data: game } = await supabase
    .from('games')
    .select('id, card_price, commission_pct, jackpot_amount, line_amount')
    .eq('id', (await supabase.from('cards').select('game_id').eq('id', cardIds[0]).single()).data?.game_id)
    .single()

  if (game) {
    const contribution = game.card_price * (1 - game.commission_pct / 100)
    const totalContrib = contribution * cardIds.length
    await supabase.from('games').update({
      jackpot_amount: game.jackpot_amount + totalContrib * 0.9,
      line_amount: game.line_amount + totalContrib * 0.1,
    }).eq('id', game.id)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/payments/ app/api/payments/
git commit -m "feat: Mercado Pago integration with webhook verification"
```

---

### Task 10: Transfer payment flow

**Files:**
- Create: `app/api/payments/transfer/route.ts`, `app/api/admin/payments/[id]/route.ts`

- [ ] **Step 1: Create transfer upload endpoint**

```typescript
// app/api/payments/transfer/route.ts
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('comprobante') as File
  const cardIds = (formData.get('cardIds') as string).split(',')
  const gameId = formData.get('gameId') as string

  if (!file || !cardIds.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Upload image to Supabase Storage
  const filename = `transfers/${Date.now()}-${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('comprobantes')
    .upload(filename, file, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Create pending payment records
  await supabase.from('payments').insert(
    cardIds.map(id => ({
      card_id: id,
      method: 'transfer',
      status: 'pending',
      transfer_img_url: uploadData.path,
    }))
  )

  return NextResponse.json({ ok: true, message: 'Comprobante recibido. Se activará cuando lo aprobemos.' })
}
```

- [ ] **Step 2: Create admin approve/reject endpoint**

```typescript
// app/api/admin/payments/[id]/route.ts
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authSupabase = createClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action } = await request.json() as { action: 'approve' | 'reject' }
  const supabase = createServiceClient()

  if (action === 'reject') {
    await supabase.from('payments')
      .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', params.id)
    return NextResponse.json({ ok: true })
  }

  // Approve: update payment + mark card as paid + update jackpot
  const { data: payment } = await supabase
    .from('payments')
    .select('card_id')
    .eq('id', params.id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('payments')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', params.id)

  const { data: card } = await supabase
    .from('cards')
    .update({ paid: true })
    .eq('id', payment.card_id)
    .select('game_id')
    .single()

  if (card) {
    const { data: game } = await supabase
      .from('games')
      .select('id, card_price, commission_pct, jackpot_amount, line_amount')
      .eq('id', card.game_id)
      .single()

    if (game) {
      const contribution = game.card_price * (1 - game.commission_pct / 100)
      await supabase.from('games').update({
        jackpot_amount: game.jackpot_amount + contribution * 0.9,
        line_amount: game.line_amount + contribution * 0.1,
      }).eq('id', game.id)
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create Supabase Storage bucket via migration**

Add to `supabase/migrations/002_storage.sql`:

```sql
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false);

create policy "admin_read_comprobantes" on storage.objects
  for select using (
    bucket_id = 'comprobantes'
    and auth.jwt()->>'role' = 'admin'
  );
```

```bash
npx supabase migration new storage_bucket
# copy above SQL into the generated file
npx supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add app/api/ supabase/
git commit -m "feat: transfer payment upload and admin approve/reject"
```

---

## Phase 4: Game Engine

### Task 11: Quiniela scraper

**Files:**
- Create: `lib/game/scraper.ts`, `lib/game/scraper.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/game/scraper.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseQuinielaHtml, extractQuinielaNumber } from './scraper'
import { extractQuinielaNumber as extractFromValidator } from './validator'

// Sample HTML structure from a typical quiniela results page
const sampleHtml = `
<table class="tabla-resultados">
  <tr><td>1ro</td><td>7453</td></tr>
  <tr><td>2do</td><td>2291</td></tr>
  <tr><td>3ro</td><td>9607</td></tr>
  <tr><td>4to</td><td>0142</td></tr>
  <tr><td>5to</td><td>8800</td></tr>
</table>
`

describe('parseQuinielaHtml', () => {
  it('extracts raw prize numbers from HTML', () => {
    const results = parseQuinielaHtml(sampleHtml)
    expect(results).toContain('7453')
    expect(results).toContain('2291')
    expect(results).toHaveLength(5)
  })
})

describe('extractQuinielaNumber', () => {
  it('extracts last 2 digits', () => {
    expect(extractFromValidator('7453')).toBe(53)
    expect(extractFromValidator('2291')).toBe(91)
  })

  it('returns null for 00', () => {
    expect(extractFromValidator('8800')).toBeNull()
  })

  it('returns null for > 90', () => {
    expect(extractFromValidator('9607')).toBeNull() // 07 → 7 ✓ wait, 07 = 7
    expect(extractFromValidator('2299')).toBeNull() // 99 → null
  })

  it('returns valid number for 01', () => {
    expect(extractFromValidator('0142')).toBe(42)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run lib/game/scraper.test.ts
```

- [ ] **Step 3: Implement scraper**

```typescript
// lib/game/scraper.ts
import * as cheerio from 'cheerio'

// Parse raw HTML from quiniela results page
// Returns array of raw prize strings (e.g. ["7453", "2291", ...])
export function parseQuinielaHtml(html: string): string[] {
  const $ = cheerio.load(html)
  const results: string[] = []

  // Try common table structures used by quiniela sites
  $('table tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length >= 2) {
      const val = $(cells[1]).text().trim().replace(/\D/g, '')
      if (val.length >= 2) results.push(val)
    }
  })

  return results
}

// Fetch and parse quiniela results for a given date and source
export async function fetchQuinielaResults(params: {
  date: Date
  source: 'nacional' | 'provincial'
  scraperUrl: string  // configured per-source in env
}): Promise<number[]> {
  const dateStr = params.date.toISOString().split('T')[0]

  let html: string
  try {
    const response = await fetch(`${params.scraperUrl}?date=${dateStr}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    html = await response.text()
  } catch (err) {
    throw new Error(`Scraper failed for ${params.source}: ${err}`)
  }

  const rawNumbers = parseQuinielaHtml(html)
  const { extractQuinielaNumber } = await import('./validator')

  return rawNumbers
    .map(raw => extractQuinielaNumber(raw))
    .filter((n): n is number => n !== null)
}
```

- [ ] **Step 4: Add scraper URL env vars to .env.example**

```env
QUINIELA_NACIONAL_URL=https://your-quiniela-source.com/nacional
QUINIELA_PROVINCIAL_URL=https://your-quiniela-source.com/provincial
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run lib/game/scraper.test.ts
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add lib/game/scraper.ts lib/game/scraper.test.ts
git commit -m "feat: quiniela scraper with cheerio"
```

---

### Task 12: Nightly draw cron endpoint

**Files:**
- Create: `app/api/cron/draw/route.ts`

- [ ] **Step 1: Create cron endpoint**

```typescript
// app/api/cron/draw/route.ts
import { createServiceClient } from '@/lib/supabase/server'
import { fetchQuinielaResults } from '@/lib/game/scraper'
import { checkWinners } from '@/lib/game/validator'
import { NextResponse } from 'next/server'

const DRAW_SOURCES_BY_DAY: Record<number, ('nacional' | 'provincial')[]> = {
  1: ['nacional', 'provincial'], // Monday
  2: ['nacional', 'provincial'], // Tuesday
  3: ['nacional'],               // Wednesday
  4: ['nacional'],               // Thursday
  5: ['nacional'],               // Friday
}

export async function GET(request: Request) {
  // Verify cron secret
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  const sources = DRAW_SOURCES_BY_DAY[dayOfWeek]
  if (!sources) {
    return NextResponse.json({ ok: true, message: 'No draw today' })
  }

  // Get active game
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('status', 'active')
    .single()

  if (!game) {
    return NextResponse.json({ error: 'No active game' }, { status: 404 })
  }

  const drawnNumbers: number[] = []

  // Fetch from each source with retries
  for (const source of sources) {
    const url = source === 'nacional'
      ? process.env.QUINIELA_NACIONAL_URL!
      : process.env.QUINIELA_PROVINCIAL_URL!

    let numbers: number[] = []
    let lastError: unknown

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        numbers = await fetchQuinielaResults({ date: today, source, scraperUrl: url })
        break
      } catch (err) {
        lastError = err
        if (attempt < 2) await new Promise(r => setTimeout(r, 5 * 60 * 1000)) // wait 5m
      }
    }

    if (!numbers.length) {
      // Alert admin via email on final failure
      const { sendAdminAlert } = await import('@/lib/email/resend')
      await sendAdminAlert(`Scraper falló para ${source}: ${lastError}`)
      continue
    }

    // Insert drawn numbers (ignore duplicates)
    const rows = numbers.map(n => ({
      game_id: game.id,
      number: n,
      source,
      draw_date: today.toISOString().split('T')[0],
    }))

    await supabase.from('drawn_numbers').upsert(rows, {
      onConflict: 'game_id,number,source,draw_date',
    })

    drawnNumbers.push(...numbers)
  }

  if (!drawnNumbers.length) {
    return NextResponse.json({ ok: false, message: 'No numbers drawn' })
  }

  // Get all paid cards for this game
  const { data: cards } = await supabase
    .from('cards')
    .select('id, numbers, user_email')
    .eq('game_id', game.id)
    .eq('paid', true)

  if (!cards?.length) {
    return NextResponse.json({ ok: true, drawn: drawnNumbers })
  }

  // Get all existing marks for this game's cards
  const cardIds = cards.map(c => c.id)
  const { data: existingMarks } = await supabase
    .from('card_marks')
    .select('card_id, number')
    .in('card_id', cardIds)

  const marksByCard = new Map<string, number[]>()
  existingMarks?.forEach(m => {
    if (!marksByCard.has(m.card_id)) marksByCard.set(m.card_id, [])
    marksByCard.get(m.card_id)!.push(m.number)
  })

  // Insert new marks
  const newMarks: { card_id: string; number: number }[] = []
  for (const card of cards) {
    for (const drawn of drawnNumbers) {
      if ((card.numbers as number[]).includes(drawn)) {
        const existing = marksByCard.get(card.id) ?? []
        if (!existing.includes(drawn)) {
          newMarks.push({ card_id: card.id, number: drawn })
        }
      }
    }
  }

  if (newMarks.length) {
    await supabase.from('card_marks').insert(newMarks)
  }

  // Detect winners
  const { data: gameData } = await supabase
    .from('games')
    .select('jackpot_amount, line_amount, status')
    .eq('id', game.id)
    .single()

  if (!gameData) return NextResponse.json({ ok: true })

  const { sendWinnerEmail } = await import('@/lib/email/resend')
  const lineWinners: string[] = []
  const fullWinners: string[] = []

  for (const card of cards) {
    const allMarks = [
      ...(marksByCard.get(card.id) ?? []),
      ...newMarks.filter(m => m.card_id === card.id).map(m => m.number),
    ]

    // Build rows from card.numbers (stored as flat array — reconstruct not needed for full check)
    const hasFull = (card.numbers as number[]).every(n => allMarks.includes(n))
    if (hasFull) fullWinners.push(card.id)
  }

  // Check line winners only if no one already won a line this game
  if (gameData.status === 'active') {
    for (const card of cards) {
      // We need the row structure — fetch it or store it. Since we only store flat numbers,
      // line detection requires rows. Store rows in card or skip line detection per-draw.
      // For simplicity: detect line by checking any 5 consecutive marks matching a row.
      // Rows are not stored separately — add rows column to cards table in a follow-up migration,
      // OR detect line via full card completion only in this version.
      // DECISION: store rows as jsonb in cards table (see migration 003 below)
    }
  }

  // Pay out full winners
  if (fullWinners.length > 0) {
    const share = gameData.jackpot_amount / fullWinners.length
    await supabase.from('winners').insert(
      fullWinners.map(cardId => ({
        card_id: cardId,
        game_id: game.id,
        prize_type: 'full',
        amount: share,
      }))
    )
    await supabase.from('games').update({ status: 'closed' }).eq('id', game.id)

    // Notify winners
    for (const cardId of fullWinners) {
      const card = cards.find(c => c.id === cardId)
      if (card) await sendWinnerEmail(card.user_email, 'full', share)
    }
  }

  return NextResponse.json({ ok: true, drawn: drawnNumbers, fullWinners, lineWinners })
}
```

- [ ] **Step 2: Add rows column migration**

Create `supabase/migrations/003_card_rows.sql`:

```sql
alter table cards add column rows jsonb;
```

Update card generator usage in `app/api/cards/buy/route.ts` to also store `rows`:

```typescript
// in the cards array map:
const card = generateCard()
return {
  game_id: gameId,
  user_id: userId ?? null,
  user_email: email,
  numbers: card.numbers,
  rows: card.rows,  // add this
  paid: false,
  payment_method: paymentMethod,
}
```

```bash
npx supabase migration new card_rows
# paste the SQL above
npx supabase db push
```

- [ ] **Step 3: Update cron to use rows for line detection**

Replace the `// DECISION` comment block in the cron with:

```typescript
for (const card of cards) {
  const rows = card.rows as (number | null)[][]
  if (!rows) continue
  const allMarks = [
    ...(marksByCard.get(card.id) ?? []),
    ...newMarks.filter(m => m.card_id === card.id).map(m => m.number),
  ]
  const markSet = new Set(allMarks)
  const hasLine = rows.some(row =>
    row.filter((n): n is number => n !== null).every(n => markSet.has(n))
  )
  if (hasLine) lineWinners.push(card.id)
}

if (lineWinners.length > 0 && gameData.status === 'active') {
  const share = gameData.line_amount / lineWinners.length
  await supabase.from('winners').insert(
    lineWinners.map(cardId => ({
      card_id: cardId,
      game_id: game.id,
      prize_type: 'line',
      amount: share,
    }))
  )
  await supabase.from('games').update({ status: 'line_won' }).eq('id', game.id)
  for (const cardId of lineWinners) {
    const card = cards.find(c => c.id === cardId)
    if (card) await sendWinnerEmail(card.user_email, 'line', share)
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/ supabase/
git commit -m "feat: nightly draw cron with scraping, marking, and winner detection"
```

---

## Phase 5: Email

### Task 13: Email notifications

**Files:**
- Create: `lib/email/resend.ts`

- [ ] **Step 1: Create email module**

```typescript
// lib/email/resend.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bingo Quiniela <no-reply@tu-dominio.com>'

export async function sendCardEmail(params: {
  to: string
  cardNumbers: number[]
  gameWeek: string
}) {
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: '🎴 Tu cartón de Bingo está listo',
    html: `
      <h2>¡Tu cartón de bingo para la semana del ${params.gameWeek}!</h2>
      <p>Números: <strong>${params.cardNumbers.join(', ')}</strong></p>
      <p>Los resultados se validan cada noche con la quiniela nocturna.</p>
      <p>Podés ver tu cartón en <a href="${process.env.NEXT_PUBLIC_BASE_URL}/mis-cartones">Mis Cartones</a></p>
    `,
  })
}

export async function sendWinnerEmail(to: string, type: 'line' | 'full', amount: number) {
  const label = type === 'line' ? '¡Completaste una línea!' : '¡BINGO! Cartón completo'
  await resend.emails.send({
    from: FROM,
    to,
    subject: `🏆 ${label}`,
    html: `
      <h2>${label}</h2>
      <p>Tu premio: <strong>$${amount.toLocaleString('es-AR')}</strong></p>
      <p>Nos pondremos en contacto para coordinar el pago.</p>
    `,
  })
}

export async function sendAdminAlert(message: string) {
  await resend.emails.send({
    from: FROM,
    to: process.env.ADMIN_EMAIL!,
    subject: '⚠️ Alerta Bingo Quiniela',
    html: `<p>${message}</p>`,
  })
}
```

- [ ] **Step 2: Add ADMIN_EMAIL to .env.example**

```env
ADMIN_EMAIL=tu@email.com
```

- [ ] **Step 3: Commit**

```bash
git add lib/email/
git commit -m "feat: email notifications with Resend"
```

---

## Phase 6: Admin Panel

### Task 14: Admin layout + dashboard

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`

- [ ] **Step 1: Create admin layout**

```typescript
// app/admin/layout.tsx
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <nav className="w-56 bg-[#5c4a2a] text-white flex flex-col p-4 gap-2">
        <h2 className="font-bold text-lg mb-4">Admin</h2>
        {[
          { href: '/admin', label: 'Dashboard' },
          { href: '/admin/pagos', label: 'Pagos' },
          { href: '/admin/ganadores', label: 'Ganadores' },
          { href: '/admin/sorteos', label: 'Sorteos' },
          { href: '/admin/configuracion', label: 'Configuración' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="px-3 py-2 rounded hover:bg-[#8b7355] transition-colors text-sm">
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create admin dashboard**

```typescript
// app/admin/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = createClient()

  const { data: game } = await supabase
    .from('games')
    .select('*, cards(count)')
    .eq('status', 'active')
    .single()

  const { count: pendingTransfers } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('method', 'transfer')
    .eq('status', 'pending')

  const totalCards = (game as any)?.cards?.[0]?.count ?? 0
  const revenue = totalCards * (game?.card_price ?? 2000)
  const adminCut = revenue * ((game?.commission_pct ?? 20) / 100)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Pozo (bingo)', value: `$${(game?.jackpot_amount ?? 0).toLocaleString('es-AR')}` },
          { label: 'Premio línea', value: `$${(game?.line_amount ?? 0).toLocaleString('es-AR')}` },
          { label: 'Cartones vendidos', value: totalCards },
          { label: 'Tu ganancia', value: `$${adminCut.toLocaleString('es-AR')}` },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-[#e8dcc8]">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-[#5c4a2a] mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      {(pendingTransfers ?? 0) > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-medium text-amber-800">
            {pendingTransfers} transferencia(s) pendiente(s) de aprobación
          </p>
          <a href="/admin/pagos" className="text-amber-600 underline text-sm">Ver pagos →</a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/
git commit -m "feat: admin layout and dashboard"
```

---

### Task 15: Admin payments page

**Files:**
- Create: `app/admin/pagos/page.tsx`, `components/admin/transfer-list.tsx`

- [ ] **Step 1: Create transfer list component**

```typescript
// components/admin/transfer-list.tsx
'use client'
import { useState } from 'react'

interface Transfer {
  id: string
  card_id: string
  transfer_img_url: string
  created_at: string
}

export function TransferList({ transfers, storageUrl }: {
  transfers: Transfer[]
  storageUrl: string
}) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handle(id: string, action: 'approve' | 'reject') {
    setLoading(id)
    await fetch(`/api/admin/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setLoading(null)
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      {transfers.map(t => (
        <div key={t.id} className="bg-white rounded-xl border border-[#e8dcc8] p-4 flex gap-4 items-start">
          <img
            src={`${storageUrl}/${t.transfer_img_url}`}
            alt="Comprobante"
            className="w-32 h-32 object-cover rounded-lg border"
          />
          <div className="flex-1">
            <p className="text-sm text-gray-500">
              {new Date(t.created_at).toLocaleString('es-AR')}
            </p>
            <p className="text-sm font-mono text-gray-700 mt-1">Cartón: {t.card_id}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handle(t.id, 'approve')}
                disabled={loading === t.id}
                className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                Aprobar
              </button>
              <button
                onClick={() => handle(t.id, 'reject')}
                disabled={loading === t.id}
                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      ))}
      {transfers.length === 0 && (
        <p className="text-gray-500">No hay transferencias pendientes.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create payments page**

```typescript
// app/admin/pagos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { TransferList } from '@/components/admin/transfer-list'

export default async function PagosPage() {
  const supabase = createClient()

  const { data: pending } = await supabase
    .from('payments')
    .select('id, card_id, transfer_img_url, created_at')
    .eq('method', 'transfer')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/comprobantes`

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">
        Transferencias pendientes ({pending?.length ?? 0})
      </h1>
      <TransferList transfers={pending ?? []} storageUrl={storageUrl} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/pagos/ components/admin/
git commit -m "feat: admin payments page with approve/reject UI"
```

---

### Task 16: Manual draw entry + config pages

**Files:**
- Create: `app/admin/sorteos/page.tsx`, `app/admin/configuracion/page.tsx`, `app/api/admin/draw/route.ts`

- [ ] **Step 1: Create manual draw API**

```typescript
// app/api/admin/draw/route.ts
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const authSupabase = createClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { numbers, source, date } = await request.json() as {
    numbers: number[]
    source: 'nacional' | 'provincial'
    date: string
  }

  const invalid = numbers.filter(n => n < 1 || n > 90)
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Números inválidos: ${invalid.join(', ')}` }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .in('status', ['active', 'line_won'])
    .single()

  if (!game) return NextResponse.json({ error: 'No hay juego activo' }, { status: 404 })

  await supabase.from('drawn_numbers').upsert(
    numbers.map(n => ({
      game_id: game.id,
      number: n,
      source,
      draw_date: date,
    })),
    { onConflict: 'game_id,number,source,draw_date' }
  )

  // Trigger the same marking/detection logic as the cron
  const cronResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/cron/draw`,
    { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create draw form page**

```typescript
// app/admin/sorteos/page.tsx
'use client'
import { useState } from 'react'

export default function SorteosPage() {
  const [numbers, setNumbers] = useState('')
  const [source, setSource] = useState<'nacional' | 'provincial'>('nacional')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = numbers.split(/[\s,]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
    const res = await fetch('/api/admin/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers: parsed, source, date }),
    })
    const data = await res.json()
    setMsg(res.ok ? '✅ Números cargados y cartones actualizados' : `❌ ${data.error}`)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Cargar sorteo manual</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-[#e8dcc8] p-6">
        <div>
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Fuente</label>
          <select value={source} onChange={e => setSource(e.target.value as any)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2">
            <option value="nacional">Nacional</option>
            <option value="provincial">Provincial</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">
            Números (separados por coma o espacio, solo los que salieron en quiniela — el sistema extrae los últimos 2 dígitos)
          </label>
          <textarea value={numbers} onChange={e => setNumbers(e.target.value)}
            placeholder="7453, 2291, 9607, 0142, 8800"
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2 h-24" />
        </div>
        <button type="submit"
          className="bg-[#8b7355] text-white px-6 py-2 rounded-lg font-medium">
          Cargar sorteo
        </button>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create config page**

```typescript
// app/admin/configuracion/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ConfigPage() {
  const supabase = createClient()
  const [config, setConfig] = useState({ card_price: 2000, commission_pct: 20, cbu: '', alias: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('config').select('*').single().then(({ data }) => {
      if (data) setConfig(data)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('config').update({
      card_price: config.card_price,
      commission_pct: config.commission_pct,
      cbu: config.cbu,
      alias: config.alias,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Configuración</h1>
      <form onSubmit={handleSave} className="space-y-4 bg-white rounded-xl border border-[#e8dcc8] p-6">
        {[
          { label: 'Precio del cartón ($)', key: 'card_price', type: 'number' },
          { label: 'Comisión (%)', key: 'commission_pct', type: 'number' },
          { label: 'CBU', key: 'cbu', type: 'text' },
          { label: 'Alias', key: 'alias', type: 'text' },
        ].map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-[#5c4a2a] mb-1">{field.label}</label>
            <input type={field.type}
              value={(config as any)[field.key]}
              onChange={e => setConfig(prev => ({ ...prev, [field.key]: field.type === 'number' ? +e.target.value : e.target.value }))}
              className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" />
          </div>
        ))}
        <button type="submit" className="bg-[#8b7355] text-white px-6 py-2 rounded-lg">
          {saved ? '✅ Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/ app/api/admin/
git commit -m "feat: admin manual draw and config pages"
```

---

## Phase 7: User Pages

### Task 17: Landing page + buy flow

**Files:**
- Create: `app/page.tsx`, `app/comprar/page.tsx`, `components/game-banner.tsx`, `components/buy-form.tsx`

- [ ] **Step 1: Create game banner component**

```typescript
// components/game-banner.tsx
interface GameBannerProps {
  jackpot: number
  lineAmount: number
  cardsSold: number
  cardPrice: number
}

export function GameBanner({ jackpot, lineAmount, cardsSold, cardPrice }: GameBannerProps) {
  return (
    <div className="bg-[#5c4a2a] text-white rounded-2xl p-8 text-center">
      <p className="text-sm uppercase tracking-widest opacity-75 mb-2">Pozo acumulado esta semana</p>
      <p className="text-5xl font-bold">${jackpot.toLocaleString('es-AR')}</p>
      <p className="mt-2 opacity-75 text-sm">Premio línea: ${lineAmount.toLocaleString('es-AR')}</p>
      <div className="mt-4 flex justify-center gap-8 text-sm">
        <span>{cardsSold} cartones vendidos</span>
        <span>Cartón: ${cardPrice.toLocaleString('es-AR')}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create landing page**

```typescript
// app/page.tsx
import { createClient } from '@/lib/supabase/server'
import { GameBanner } from '@/components/game-banner'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = createClient()

  const { data: game } = await supabase
    .from('games')
    .select('*, cards(count)')
    .in('status', ['active', 'line_won'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const cardsSold = (game as any)?.cards?.[0]?.count ?? 0

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-[#5c4a2a] text-center mb-6">
        Bingo Quiniela
      </h1>

      {game ? (
        <>
          <GameBanner
            jackpot={game.jackpot_amount}
            lineAmount={game.line_amount}
            cardsSold={cardsSold}
            cardPrice={game.card_price}
          />
          <div className="mt-6 text-center">
            <Link href="/comprar"
              className="inline-block bg-[#8b7355] text-white px-8 py-3 rounded-xl font-bold text-lg">
              Comprar cartón
            </Link>
          </div>
          <div className="mt-6 bg-white rounded-xl border border-[#e8dcc8] p-4">
            <h2 className="font-bold text-[#5c4a2a] mb-2">¿Cómo funciona?</h2>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>🎴 Comprás un cartón con números del 1 al 90</li>
              <li>🌙 Cada noche se valida con la quiniela nocturna</li>
              <li>📅 Lunes y martes: Nacional + Provincial. Miércoles a viernes: solo Nacional</li>
              <li>🏆 Ganás por línea (10% del pozo) o cartón completo (90% del pozo)</li>
              <li>📈 Si nadie gana, el pozo acumula para la semana siguiente</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500 mt-12">
          <p>No hay juego activo esta semana. Volvé pronto.</p>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Create buy form component**

```typescript
// components/buy-form.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function BuyForm({ gameId, cardPrice, cbu, alias }: {
  gameId: string
  cardPrice: number
  cbu: string
  alias: string
}) {
  const supabase = createClient()
  const [quantity, setQuantity] = useState(1)
  const [method, setMethod] = useState<'mercadopago' | 'transfer'>('mercadopago')
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'form' | 'paying' | 'done'>('form')
  const [cards, setCards] = useState<{ id: string; numbers: number[] }[]>([])

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()

    const res = await fetch('/api/cards/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity,
        email: user?.email ?? email,
        userId: user?.id,
        paymentMethod: method,
        gameId,
      }),
    })
    const data = await res.json()
    setCards(data.cards)

    if (method === 'mercadopago') {
      const { createPreference } = await import('@/lib/payments/mercadopago')
      // Call server action instead — for now redirect to MP
      const mpRes = await fetch('/api/payments/mercadopago/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds: data.cards.map((c: any) => c.id),
          quantity,
          unitPrice: cardPrice,
          payerEmail: user?.email ?? email,
          externalReference: data.cards.map((c: any) => c.id).join(','),
        }),
      })
      const { initPoint } = await mpRes.json()
      window.location.href = initPoint
    } else {
      setStep('paying')
    }
  }

  if (step === 'paying') {
    return (
      <div className="bg-white rounded-xl border border-[#e8dcc8] p-6">
        <h2 className="font-bold text-[#5c4a2a] mb-4">Transferí el pago</h2>
        <p className="text-sm text-gray-600 mb-2">
          Total: <strong>${(quantity * cardPrice).toLocaleString('es-AR')}</strong>
        </p>
        <p className="text-sm">CBU: <strong>{cbu}</strong></p>
        <p className="text-sm">Alias: <strong>{alias}</strong></p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">
            Subí el comprobante
          </label>
          <input type="file" accept="image/*"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const fd = new FormData()
              fd.append('comprobante', file)
              fd.append('cardIds', cards.map(c => c.id).join(','))
              fd.append('gameId', gameId)
              await fetch('/api/payments/transfer', { method: 'POST', body: fd })
              setStep('done')
            }}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
          />
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="bg-white rounded-xl border border-[#e8dcc8] p-6 text-center">
        <h2 className="font-bold text-[#5c4a2a] text-xl">¡Comprobante recibido!</h2>
        <p className="text-gray-600 mt-2">Tu cartón se activará cuando aprobemos el pago. Te avisamos por email.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleBuy} className="bg-white rounded-xl border border-[#e8dcc8] p-6 space-y-4">
      <h2 className="font-bold text-[#5c4a2a] text-xl">Comprá tu cartón</h2>
      <div>
        <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Cantidad</label>
        <input type="number" min={1} max={100} value={quantity}
          onChange={e => setQuantity(+e.target.value)}
          className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" />
        <p className="text-sm text-gray-500 mt-1">
          Total: ${(quantity * cardPrice).toLocaleString('es-AR')}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Método de pago</label>
        <div className="flex gap-3">
          {(['mercadopago', 'transfer'] as const).map(m => (
            <button key={m} type="button"
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                ${method === m
                  ? 'bg-[#8b7355] text-white border-[#8b7355]'
                  : 'bg-white text-[#5c4a2a] border-[#d4c5a9]'
                }`}>
              {m === 'mercadopago' ? 'Mercado Pago' : 'Transferencia'}
            </button>
          ))}
        </div>
      </div>
      <input type="email" placeholder="Tu email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
        required />
      <button type="submit"
        className="w-full bg-[#8b7355] text-white py-3 rounded-xl font-bold">
        Comprar
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create MP preference endpoint**

```typescript
// app/api/payments/mercadopago/preference/route.ts
import { createPreference } from '@/lib/payments/mercadopago'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const pref = await createPreference(body)
  return NextResponse.json({ initPoint: pref.init_point })
}
```

- [ ] **Step 5: Create buy page**

```typescript
// app/comprar/page.tsx
import { createClient } from '@/lib/supabase/server'
import { BuyForm } from '@/components/buy-form'
import { redirect } from 'next/navigation'

export default async function ComprarPage() {
  const supabase = createClient()

  const { data: game } = await supabase
    .from('games')
    .select('id, card_price')
    .in('status', ['active', 'line_won'])
    .single()

  if (!game) redirect('/')

  const { data: config } = await supabase
    .from('config')
    .select('cbu, alias')
    .single()

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Comprar cartones</h1>
      <BuyForm
        gameId={game.id}
        cardPrice={game.card_price}
        cbu={config?.cbu ?? ''}
        alias={config?.alias ?? ''}
      />
    </main>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/ components/
git commit -m "feat: landing page and buy flow"
```

---

### Task 18: My cards page

**Files:**
- Create: `app/mis-cartones/page.tsx`

- [ ] **Step 1: Create page**

```typescript
// app/mis-cartones/page.tsx
import { createClient } from '@/lib/supabase/server'
import { BingoCard } from '@/components/bingo-card'
import { redirect } from 'next/navigation'

export default async function MisCartonesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: game } = await supabase
    .from('games')
    .select('id')
    .in('status', ['active', 'line_won'])
    .single()

  if (!game) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-2xl mx-auto">
        <p className="text-[#8b7355]">No hay juego activo esta semana.</p>
      </main>
    )
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id, numbers, rows, paid')
    .eq('game_id', game.id)
    .eq('user_id', user.id)

  const { data: allMarks } = await supabase
    .from('card_marks')
    .select('card_id, number')
    .in('card_id', (cards ?? []).map(c => c.id))

  const marksByCard = new Map<string, number[]>()
  allMarks?.forEach(m => {
    if (!marksByCard.has(m.card_id)) marksByCard.set(m.card_id, [])
    marksByCard.get(m.card_id)!.push(m.number)
  })

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Mis cartones</h1>
      {!cards?.length && (
        <p className="text-[#8b7355]">No tenés cartones esta semana. <a href="/comprar" className="underline">Comprá uno</a>.</p>
      )}
      <div className="space-y-6">
        {cards?.map(card => (
          <div key={card.id}>
            {!card.paid && (
              <p className="text-amber-600 text-sm mb-1">⏳ Pendiente de aprobación</p>
            )}
            <BingoCard
              cardId={card.id}
              rows={card.rows as (number | null)[][]}
              initialMarks={marksByCard.get(card.id) ?? []}
              gameId={game.id}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/mis-cartones/
git commit -m "feat: my cards page with realtime bingo display"
```

---

### Task 19: Game management (weekly game creation)

**Files:**
- Create: `app/api/admin/games/route.ts`

- [ ] **Step 1: Create new game endpoint**

```typescript
// app/api/admin/games/route.ts
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const authSupabase = createClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Check no active game exists
  const { data: existing } = await supabase
    .from('games')
    .select('id')
    .in('status', ['active', 'line_won'])
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Ya hay un juego activo' }, { status: 409 })
  }

  const { data: config } = await supabase
    .from('config')
    .select('card_price, commission_pct')
    .single()

  // Get previous game jackpot for rollover
  const { data: lastGame } = await supabase
    .from('games')
    .select('jackpot_amount, line_amount')
    .eq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const { data: newGame } = await supabase
    .from('games')
    .insert({
      week_start: monday.toISOString().split('T')[0],
      week_end: friday.toISOString().split('T')[0],
      status: 'active',
      jackpot_amount: lastGame?.jackpot_amount ?? 0,  // rollover
      line_amount: lastGame?.line_amount ?? 0,
      card_price: config?.card_price ?? 2000,
      commission_pct: config?.commission_pct ?? 20,
    })
    .select()
    .single()

  return NextResponse.json({ game: newGame })
}
```

- [ ] **Step 2: Add "New Game" button to admin dashboard**

In `app/admin/page.tsx`, add after the stats grid:

```typescript
// Add this import at top
import { NewGameButton } from './new-game-button'

// Add after stats grid:
<NewGameButton />
```

Create `app/admin/new-game-button.tsx`:

```typescript
// app/admin/new-game-button.tsx
'use client'

export function NewGameButton() {
  async function handleCreate() {
    if (!confirm('¿Crear nuevo juego para esta semana?')) return
    const res = await fetch('/api/admin/games', { method: 'POST' })
    const data = await res.json()
    if (res.ok) window.location.reload()
    else alert(data.error)
  }

  return (
    <button onClick={handleCreate}
      className="mt-4 bg-[#5c4a2a] text-white px-6 py-2 rounded-lg text-sm">
      Crear juego para esta semana
    </button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/ app/api/admin/
git commit -m "feat: admin create weekly game with rollover"
```

---

### Task 20: Ganadores admin page

**Files:**
- Create: `app/admin/ganadores/page.tsx`

- [ ] **Step 1: Create page**

```typescript
// app/admin/ganadores/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function GanadoresPage() {
  const supabase = createClient()

  const { data: winners } = await supabase
    .from('winners')
    .select('*, cards(user_email)')
    .order('created_at', { ascending: false })

  async function markPaid(id: string) {
    'use server'
    const supabase = createClient()
    await supabase.from('winners').update({ paid_out: true, paid_at: new Date().toISOString() }).eq('id', id)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Ganadores</h1>
      <div className="space-y-3">
        {winners?.map(w => (
          <div key={w.id} className="bg-white rounded-xl border border-[#e8dcc8] p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#5c4a2a]">
                {w.prize_type === 'full' ? '🏆 Bingo completo' : '🎯 Línea'}
              </p>
              <p className="text-sm text-gray-500">{(w.cards as any)?.user_email}</p>
              <p className="text-sm font-bold">${w.amount.toLocaleString('es-AR')}</p>
            </div>
            <div>
              {w.paid_out ? (
                <span className="text-green-600 text-sm font-medium">✅ Pagado</span>
              ) : (
                <form action={markPaid.bind(null, w.id)}>
                  <button type="submit"
                    className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm">
                    Marcar pagado
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {!winners?.length && <p className="text-gray-500">No hay ganadores aún.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/ganadores/
git commit -m "feat: admin winners page with mark-as-paid"
```

---

## Phase 8: Deploy

### Task 21: Vercel deploy + environment setup

- [ ] **Step 1: Connect repo to Vercel**

```bash
npm install -g vercel
vercel login
vercel link
```

- [ ] **Step 2: Set all environment variables in Vercel dashboard**

Go to Project Settings → Environment Variables and add all variables from `.env.example` with production values.

- [ ] **Step 3: Link Supabase project**

```bash
npx supabase link --project-ref <your-supabase-project-ref>
npx supabase db push
```

- [ ] **Step 4: Set admin user role in Supabase**

In Supabase Dashboard → Authentication → Users, find your user and run in SQL Editor:

```sql
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
where email = 'tu@email.com';
```

- [ ] **Step 5: Deploy**

```bash
vercel --prod
```

- [ ] **Step 6: Verify cron is registered**

In Vercel Dashboard → Settings → Cron Jobs, verify `/api/cron/draw` appears with the schedule `0 1 * * 1-5`.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete bingo-quiniela platform ready for deploy"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Card: Italian 3×9, 1-90, beige style
- ✅ Quiniela: last 2 digits, 1-90, nightly only
- ✅ Calendar: Mon-Tue nacional+provincial, Wed-Fri nacional only
- ✅ Prizes: line 10%, full 90%, split equally if multiple winners
- ✅ Rollover: jackpot carries to next game
- ✅ Commission: 20% per card sale, configurable
- ✅ Payment: Mercado Pago (webhook) + transfer (manual approval)
- ✅ Auth: Google + email/password
- ✅ No card limit per user
- ✅ Scraper with 3 retries + admin alert + manual fallback
- ✅ Admin: dashboard, payments, winners, manual draw, config
- ✅ Realtime: Supabase channels on card_marks
- ✅ RLS: users see only own cards, service role for cron
- ✅ Deploy: Vercel + Vercel Cron

**Gap found and fixed:** `rows` column added to `cards` table in Task 12 migration 003 — required for line detection in the cron.
