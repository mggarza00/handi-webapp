-- Create professionals table for public professional profiles
begin;

create table if not exists public.professionals (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
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

alter table public.professionals enable row level security;

-- Ensure columns exist even if table already existed (id is PK already)
alter table public.professionals add column if not exists active boolean default true;
alter table public.professionals add column if not exists full_name text;
alter table public.professionals add column if not exists avatar_url text;
alter table public.professionals add column if not exists headline text;
alter table public.professionals add column if not exists bio text;
alter table public.professionals add column if not exists years_experience int;
alter table public.professionals add column if not exists rating numeric;
alter table public.professionals add column if not exists is_featured boolean default false;
alter table public.professionals add column if not exists city text;
alter table public.professionals add column if not exists cities jsonb;
alter table public.professionals add column if not exists categories jsonb;
alter table public.professionals add column if not exists subcategories jsonb;
alter table public.professionals add column if not exists last_active_at timestamptz;
alter table public.professionals add column if not exists created_at timestamptz default now();

-- Ensure defaults on JSON and booleans
alter table public.professionals alter column cities set default '[]'::jsonb;
alter table public.professionals alter column categories set default '[]'::jsonb;
alter table public.professionals alter column subcategories set default '[]'::jsonb;
alter table public.professionals alter column is_featured set default false;
alter table public.professionals alter column active set default true;
alter table public.professionals alter column created_at set default now();

-- RLS: public browse, owner upsert
drop policy if exists professionals_select_public on public.professionals;
create policy professionals_select_public on public.professionals
  for select using (coalesce(active, true) = true);

drop policy if exists professionals_insert_own on public.professionals;
create policy professionals_insert_own on public.professionals
  for insert with check (auth.uid() = id);

drop policy if exists professionals_update_own on public.professionals;
create policy professionals_update_own on public.professionals
  for update using (auth.uid() = id);

-- Indexes
create index if not exists professionals_last_active_idx on public.professionals (last_active_at desc);
create index if not exists professionals_featured_rating_idx on public.professionals (is_featured desc, rating desc nulls last);

commit;
