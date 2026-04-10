-- Games table
create table games (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id),
  user_id uuid references auth.users(id),
  user_email text not null,
  numbers integer[] not null,
  rows jsonb,
  paid boolean not null default false,
  payment_method text check (payment_method in ('mercadopago', 'transfer')),
  payment_ref text,
  created_at timestamptz default now()
);

-- Payments table
create table payments (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id),
  number integer not null check (number between 1 and 90),
  source text not null check (source in ('nacional', 'provincial')),
  draw_date date not null,
  created_at timestamptz default now(),
  unique(game_id, number, source, draw_date)
);

-- Card marks (numbers crossed off)
create table card_marks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id),
  number integer not null check (number between 1 and 90),
  unique(card_id, number)
);

-- Winners table
create table winners (
  id uuid primary key default gen_random_uuid(),
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

-- Payments: users see payments for their own cards; admin sees all
create policy "payments_own_read" on payments for select
  using (
    exists (
      select 1 from cards
      where cards.id = payments.card_id
        and (cards.user_id = auth.uid() or auth.jwt()->>'role' = 'admin')
    )
  );

-- Admin-only write policies (service role bypasses RLS)
create policy "admin_all_config" on config
  for all
  using (auth.jwt()->>'role' = 'admin')
  with check (auth.jwt()->>'role' = 'admin');

-- Indexes for foreign keys
create index on cards(game_id);
create index on cards(user_id);
create index on payments(card_id);
create index on winners(game_id);
create index on card_marks(card_id);
create index on drawn_numbers(game_id);
