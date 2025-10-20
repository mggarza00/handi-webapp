-- Create table to store onboarding applications from professionals
create table if not exists public.pro_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text not null,
  services_desc text not null,
  cities jsonb not null,
  categories jsonb not null,
  years_experience int not null,
  refs jsonb not null,
  uploads jsonb not null,
  status text not null default 'pending', -- pending | accepted | rejected
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.pro_applications enable row level security;

-- Policies: users can see their own submission; admins via service role
drop policy if exists pro_apps_select_own on public.pro_applications;
create policy pro_apps_select_own on public.pro_applications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists pro_apps_insert_self on public.pro_applications;
create policy pro_apps_insert_self on public.pro_applications
  for insert to authenticated with check (auth.uid() = user_id);

-- Indexes for admin browsing
create index if not exists pro_apps_created_at_idx on public.pro_applications (created_at desc);
create index if not exists pro_apps_status_idx on public.pro_applications (status);
create index if not exists pro_apps_user_idx on public.pro_applications (user_id);

