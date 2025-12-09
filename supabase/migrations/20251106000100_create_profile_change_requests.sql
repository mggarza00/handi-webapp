-- Migration: create profile_change_requests table and RLS policies
-- Safe to run multiple times (IF NOT EXISTS / DROP POLICY IF EXISTS)

-- Ensure extension for UUIDs
create extension if not exists pgcrypto;

-- Table
create table if not exists public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references public.profiles(id),
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Indexes
create index if not exists profile_change_requests_user_status_idx
  on public.profile_change_requests (user_id, status);

-- RLS
alter table public.profile_change_requests enable row level security;

-- Policies
drop policy if exists pcr_select_owner on public.profile_change_requests;
create policy pcr_select_owner on public.profile_change_requests
for select using (
  auth.uid() = user_id or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false) = true)
  )
);

drop policy if exists pcr_insert_self on public.profile_change_requests;
create policy pcr_insert_self on public.profile_change_requests
for insert with check (auth.uid() = user_id);

drop policy if exists pcr_update_admin on public.profile_change_requests;
create policy pcr_update_admin on public.profile_change_requests
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false) = true)
  )
);

drop policy if exists pcr_admin_all on public.profile_change_requests;
create policy pcr_admin_all on public.profile_change_requests
for delete using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false) = true)
  )
);

