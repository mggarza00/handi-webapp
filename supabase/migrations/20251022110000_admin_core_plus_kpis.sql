-- Admin core tables and KPI views
create extension if not exists pgcrypto;

-- Helper: allow admin via JWT claim `role`
create or replace function public.is_admin_jwt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with claims as (
    select coalesce(current_setting('request.jwt.claims', true), '{}')::json as c
  )
  select lower(coalesce(c->>'role','')) in ('owner','admin','ops','finance','support','reviewer')
  from claims;
$$;

-- Config table
create table if not exists public.config (
  id smallint primary key default 1,
  commission_client numeric not null default 0,
  commission_pro numeric not null default 0,
  vat numeric not null default 16,
  updated_at timestamptz not null default now()
);
alter table public.config enable row level security;
do $$ begin
  create policy config_admin_read on public.config for select using (public.is_admin_jwt());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy config_admin_write on public.config for update using (public.is_admin_jwt());
exception when duplicate_object then null; end $$;

-- Webhooks log
create table if not exists public.webhooks_log (
  id bigserial primary key,
  provider text not null,
  event text not null,
  status_code int not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.webhooks_log enable row level security;
do $$ begin
  create policy webhooks_log_admin_read on public.webhooks_log for select using (public.is_admin_jwt());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy webhooks_log_admin_write on public.webhooks_log for insert with check (public.is_admin_jwt());
exception when duplicate_object then null; end $$;
create index if not exists webhooks_log_created_at_idx on public.webhooks_log(created_at);

-- Audit log (ensure exists and extend)
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid null,
  action text not null,
  entity text null,
  entity_id text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.audit_log
    add column if not exists actor_id uuid null,
    add column if not exists entity text null,
    add column if not exists entity_id text null;
exception when others then null; end $$;
alter table public.audit_log enable row level security;
do $$ begin
  create policy audit_log_admin_read2 on public.audit_log for select using (public.is_admin_jwt());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy audit_log_admin_write2 on public.audit_log for insert with check (public.is_admin_jwt());
exception when duplicate_object then null; end $$;
create index if not exists audit_log_created_at_idx on public.audit_log(created_at);

-- KPI Views moved to payments/jobs migrations to avoid dependency order

