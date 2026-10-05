-- SnackStack database schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Then run each file in supabase/migrations/ in order.
--
-- Every table has a user_id column and Row Level Security (RLS) policies so
-- each signed-in user can only see and change their own rows. The browser key
-- is public, so RLS is what actually protects the data.

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  created_at timestamptz not null default now()
);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric not null default 1 check (quantity >= 0),
  unit text,
  category text,
  expires_on date,
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  price numeric(10, 2) not null check (price >= 0),
  store text,
  purchased_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index on public.shopping_items (user_id);
create index on public.pantry_items (user_id);
create index on public.purchases (user_id, purchased_on);

alter table public.shopping_items enable row level security;
alter table public.pantry_items enable row level security;
alter table public.purchases enable row level security;

create policy "Users manage their own shopping items" on public.shopping_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own pantry items" on public.pantry_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own purchases" on public.purchases
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Signed-in users may use these tables (still limited to their own rows by RLS).
-- Anonymous visitors get no access.
grant select, insert, update, delete on public.shopping_items, public.pantry_items, public.purchases to authenticated;
revoke all on public.shopping_items, public.pantry_items, public.purchases from anon;
