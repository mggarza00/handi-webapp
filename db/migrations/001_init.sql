-- This project uses Supabase migrations under ./supabase/migrations
-- For local development, prefer running:
--   supabase migration up --linked
-- The following DDL mirrors admin core tables for reference.

create table if not exists public.config (
  id smallint primary key default 1,
  commission_client numeric not null default 0,
  commission_pro numeric not null default 0,
  vat numeric not null default 16,
  updated_at timestamptz not null default now()
);

create table if not exists public.webhooks_log (
  id bigserial primary key,
  provider text not null,
  event text not null,
  status_code int not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid null,
  action text not null,
  entity text null,
  entity_id text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

