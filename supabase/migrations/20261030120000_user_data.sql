-- The signed-in user's plan, removed recipes and own recipes: one row per key the browser would use
-- in localStorage, holding the same JSON value
create table public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

-- In a subquery, auth.uid() is read once per statement instead of once per row

create policy "Users read their own data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users change their own data" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own data" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Supabase grants new tables in public to anon by default; only signed-in users may use this one
revoke all on public.user_data from anon, authenticated;
grant select, insert, update, delete on public.user_data to authenticated;
