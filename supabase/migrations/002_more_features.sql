-- SnackStack update 002: notes, aisles, pantry locations, low-stock levels and food-waste tracking.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.

alter table public.shopping_items
  add column if not exists note text,
  add column if not exists category text;

alter table public.pantry_items
  add column if not exists location text,
  add column if not exists min_quantity numeric check (min_quantity >= 0);

alter table public.purchases
  add column if not exists category text;

create table if not exists public.waste_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  cost numeric(10, 2) check (cost >= 0),
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists waste_log_user_logged_on_idx on public.waste_log (user_id, logged_on);

alter table public.waste_log enable row level security;

drop policy if exists "Users manage their own waste log" on public.waste_log;
create policy "Users manage their own waste log" on public.waste_log
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.waste_log to authenticated;
revoke all on public.waste_log from anon;
