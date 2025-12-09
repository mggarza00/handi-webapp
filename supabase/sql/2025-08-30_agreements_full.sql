-- Handi - AGREEMENTS (DDL + RLS + TRIGGERS + VERIFY)
-- Ejecutar en el SQL Editor de Supabase o vía psql.

-- ======================
-- 1) Extensiones
-- ======================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ======================
-- 2) Tabla AGREEMENTS
-- ======================
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  amount numeric,
  status text check (status in (
    'negotiating','accepted','paid','in_progress','completed','cancelled','disputed'
  )) default 'negotiating',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilitar RLS
alter table public.agreements enable row level security;

-- ======================
-- 3) Policies (RLS)
-- ======================
drop policy if exists "agreements.select.parties" on public.agreements;
drop policy if exists "agreements.insert.by_parties" on public.agreements;
drop policy if exists "agreements.update.by_parties" on public.agreements;

create policy "agreements.select.parties" on public.agreements
for select using (
  exists (select 1 from public.requests r where r.id = agreements.request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

create policy "agreements.insert.by_parties" on public.agreements
for insert with check (
  exists (select 1 from public.requests r where r.id = request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

create policy "agreements.update.by_parties" on public.agreements
for update using (
  exists (select 1 from public.requests r where r.id = agreements.request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

-- ======================
-- 4) Trigger updated_at
-- ======================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_updated_at_agreements on public.agreements;
create trigger set_updated_at_agreements
before update on public.agreements
for each row execute function public.tg_set_updated_at();

-- ======================
-- 5) Verificación rápida
--    (Puedes ejecutar todo junto; estas queries reportan el estado al final)
-- ======================

-- 5.1 Columnas
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='agreements'
order by ordinal_position;

-- 5.2 RLS habilitado
select c.relname as table, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'agreements';

-- 5.3 Policies existentes (nombre correcto: policyname)
select policyname, schemaname, tablename, cmd, roles, permissive, qual, with_check
from pg_policies
where schemaname='public' and tablename='agreements'
order by policyname;

-- 5.4 Triggers en agreements
select t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'agreements' and not t.tgisinternal
order by t.tgname;

-- 5.5 Función del trigger
select n.nspname as schema,
       p.proname as function_name,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'tg_set_updated_at';

-- 5.6 Índices de agreements (si existen)
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'agreements'
order by indexname;
