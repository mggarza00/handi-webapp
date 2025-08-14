create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('client','pro')) default 'client',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  city text,
  category text,
  subcategory text,
  budget numeric,
  required_at date,
  status text check (status in ('active','closed')) default 'active',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.requests enable row level security;

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

drop policy if exists "read own profile" on public.profiles;
drop policy if exists "upsert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "upsert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "read active requests" on public.requests;
drop policy if exists "read own requests" on public.requests;
drop policy if exists "insert own request" on public.requests;
drop policy if exists "update own request" on public.requests;
create policy "read active requests" on public.requests for select using (status = 'active');
create policy "read own requests" on public.requests for select using (created_by = auth.uid());
create policy "insert own request" on public.requests for insert with check (created_by = auth.uid());
create policy "update own request" on public.requests for update using (created_by = auth.uid());

drop policy if exists "read own applications" on public.applications;
drop policy if exists "client reads applications on own requests" on public.applications;
drop policy if exists "insert own application" on public.applications;
drop policy if exists "update own application (pro)" on public.applications;
drop policy if exists "update application (client on own requests)" on public.applications;
create policy "read own applications" on public.applications for select using (professional_id = auth.uid());
create policy "client reads applications on own requests" on public.applications
  for select using (exists (
    select 1 from public.requests r
    where r.id = applications.request_id and r.created_by = auth.uid()
  ));
create policy "insert own application" on public.applications
  for insert with check (professional_id = auth.uid());
create policy "update own application (pro)" on public.applications for update using (professional_id = auth.uid());
create policy "update application (client on own requests)" on public.applications
  for update using (exists (
    select 1 from public.requests r
    where r.id = applications.request_id and r.created_by = auth.uid()
  ));
