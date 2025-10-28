-- Web Push Subscriptions table + RLS
-- Creates per-user subscriptions for Web Push and enforces ownership via RLS

create extension if not exists pgcrypto;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.web_push_subscriptions enable row level security;

create index if not exists web_push_subscriptions_user_id_idx on public.web_push_subscriptions(user_id);

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_web_push_subscriptions_updated_at on public.web_push_subscriptions;
create trigger trg_web_push_subscriptions_updated_at
before update on public.web_push_subscriptions
for each row execute function public.set_updated_at();

-- RLS Policies: Owner-only CRUD
create policy if not exists "select_own_web_push_subscriptions"
  on public.web_push_subscriptions
  for select
  using ( auth.uid() = user_id );

create policy if not exists "insert_own_web_push_subscriptions"
  on public.web_push_subscriptions
  for insert
  with check ( auth.uid() = user_id );

create policy if not exists "update_own_web_push_subscriptions"
  on public.web_push_subscriptions
  for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy if not exists "delete_own_web_push_subscriptions"
  on public.web_push_subscriptions
  for delete
  using ( auth.uid() = user_id );

