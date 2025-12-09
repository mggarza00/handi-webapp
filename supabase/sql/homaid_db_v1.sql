-- Handi DB V1 — Esquema + RLS + Triggers + Índices
-- Renombrado desde handee_db_v1.sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('client','pro')) default 'client',
  avatar_url text,
  headline text,
  bio text,
  years_experience int,
  rating numeric,
  is_featured boolean default false,
  active boolean default true,
  city text,
  cities jsonb default '[]'::jsonb,
  categories jsonb default '[]'::jsonb,
  subcategories jsonb default '[]'::jsonb,
  last_active_at timestamptz,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- REQUESTS
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  city text,
  category text,
  subcategories jsonb default '[]'::jsonb,
  budget numeric,
  required_at date,
  status text check (status in ('active','in_process','completed','cancelled')) default 'active',
  attachments jsonb default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.requests enable row level security;

-- APPLICATIONS
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  note text,
  status text check (status in ('applied','accepted','rejected','completed')) default 'applied',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.applications enable row level security;
create unique index if not exists ux_applications_unique_per_pair 
  on public.applications (request_id, professional_id);

-- AGREEMENTS
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
alter table public.agreements enable row level security;

-- Trigger updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_updated_at_applications on public.applications;
create trigger set_updated_at_applications before update on public.applications
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_agreements on public.agreements;
create trigger set_updated_at_agreements before update on public.agreements
for each row execute function public.tg_set_updated_at();

-- RLS Policies
drop policy if exists "profiles.select.own" on public.profiles;
drop policy if exists "profiles.insert.own" on public.profiles;
drop policy if exists "profiles.update.own" on public.profiles;

create policy "profiles.select.own" on public.profiles
for select using (auth.uid() = id);
create policy "profiles.insert.own" on public.profiles
for insert with check (auth.uid() = id);
create policy "profiles.update.own" on public.profiles
for update using (auth.uid() = id);

drop policy if exists "requests.select.active" on public.requests;
drop policy if exists "requests.select.own" on public.requests;
drop policy if exists "requests.insert.own" on public.requests;
drop policy if exists "requests.update.own" on public.requests;

create policy "requests.select.active" on public.requests
for select using (status = 'active');
create policy "requests.select.own" on public.requests
for select using (created_by = auth.uid());
create policy "requests.insert.own" on public.requests
for insert with check (created_by = auth.uid());
create policy "requests.update.own" on public.requests
for update using (created_by = auth.uid());

drop policy if exists "applications.select.own" on public.applications;
drop policy if exists "applications.select.by_request_owner" on public.applications;
drop policy if exists "applications.insert.own" on public.applications;
drop policy if exists "applications.update.own_or_request_owner" on public.applications;

create policy "applications.select.own" on public.applications
for select using (professional_id = auth.uid());
create policy "applications.select.by_request_owner" on public.applications
for select using (exists (
  select 1 from public.requests r
  where r.id = applications.request_id and r.created_by = auth.uid()
));
create policy "applications.insert.own" on public.applications
for insert with check (professional_id = auth.uid());
create policy "applications.update.own_or_request_owner" on public.applications
for update using (
  professional_id = auth.uid()
  or exists (select 1 from public.requests r where r.id = applications.request_id and r.created_by = auth.uid())
);

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

-- Índices
create index if not exists ix_profiles_last_active on public.profiles (last_active_at desc);
create index if not exists ix_profiles_featured_rating on public.profiles (is_featured desc, rating desc nulls last);
create index if not exists ix_requests_status_city on public.requests (status, city);
