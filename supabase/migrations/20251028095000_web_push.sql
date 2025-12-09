-- Web Push table and RLS (JSONB keys variant)

create extension if not exists pgcrypto;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz default now()
);

-- Ensure column exists if table pre-existed without it
alter table public.web_push_subscriptions
  add column if not exists keys jsonb;

-- Backfill jsonb keys from legacy columns if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'web_push_subscriptions' and column_name = 'p256dh'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'web_push_subscriptions' and column_name = 'auth'
  ) then
    update public.web_push_subscriptions
      set keys = jsonb_build_object('p256dh', p256dh, 'auth', auth)
    where (keys is null or jsonb_typeof(keys) is distinct from 'object');
  end if;
end $$;

-- Not null constraint after ensuring presence
alter table public.web_push_subscriptions
  alter column keys set not null;

alter table public.web_push_subscriptions enable row level security;

-- Single policy allowing owners to manage their own rows
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'web_push_subscriptions' and policyname = 'users can manage own subs'
  ) then
    create policy "users can manage own subs"
      on public.web_push_subscriptions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

