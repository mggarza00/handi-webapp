begin;

-- Unaccent extension omitted to keep index simple & portable

-- Base table for user address book
create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  address text not null,
  city text,
  lat double precision,
  lon double precision,
  postal_code text,
  label text,
  times_used int not null default 0,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deduplicate per user by normalized address (basic)
create unique index if not exists user_addresses_unique_per_user_idx
  on public.user_addresses (profile_id, md5(lower(address)));

create index if not exists user_addresses_profile_last_used_idx
  on public.user_addresses (profile_id, last_used_at desc);

-- RLS
alter table public.user_addresses enable row level security;

drop policy if exists "read own addresses" on public.user_addresses;
create policy "read own addresses" on public.user_addresses
for select using ( auth.uid() = profile_id );

drop policy if exists "insert own addresses" on public.user_addresses;
create policy "insert own addresses" on public.user_addresses
for insert with check ( auth.uid() = profile_id );

drop policy if exists "update own addresses" on public.user_addresses;
create policy "update own addresses" on public.user_addresses
for update using ( auth.uid() = profile_id );

commit;

-- Maintain updated_at automatically
begin;
-- Create or replace helper trigger function
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists set_updated_at_user_addresses on public.user_addresses;
create trigger set_updated_at_user_addresses
before update on public.user_addresses
for each row execute function public.tg_set_updated_at();

commit;
