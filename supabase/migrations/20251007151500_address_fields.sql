begin;

-- 2.1) Campos en requests
alter table public.requests
  add column if not exists address_line text,
  add column if not exists address_place_id text,
  add column if not exists address_lat double precision,
  add column if not exists address_lng double precision,
  add column if not exists address_postcode text,
  add column if not exists address_state text,
  add column if not exists address_country text,
  add column if not exists address_context jsonb;

-- 2.2) Tabla para direcciones usadas por el cliente
create table if not exists public.user_saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  address_line text not null,
  address_place_id text,
  lat double precision,
  lng double precision,
  last_used_at timestamptz default now()
);

create index if not exists user_saved_addresses_user_id_idx on public.user_saved_addresses(user_id);
-- Para soportar upsert por (user_id, address_line)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'ux_user_saved_addresses_user_line'
  ) then
    create unique index ux_user_saved_addresses_user_line on public.user_saved_addresses(user_id, address_line);
  end if;
end $$;

-- Unicidad opcional por place_id cuando exista (ignora nulos)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'ux_user_saved_addresses_user_place'
  ) then
    create unique index ux_user_saved_addresses_user_place on public.user_saved_addresses(user_id, address_place_id) where address_place_id is not null;
  end if;
end $$;

-- 2.3) RLS
alter table public.user_saved_addresses enable row level security;

drop policy if exists "own addresses only" on public.user_saved_addresses;
create policy "own addresses only"
on public.user_saved_addresses
for select using (auth.uid() = user_id);

drop policy if exists "insert own addresses" on public.user_saved_addresses;
create policy "insert own addresses"
on public.user_saved_addresses
for insert with check (auth.uid() = user_id);

drop policy if exists "update own addresses" on public.user_saved_addresses;
create policy "update own addresses"
on public.user_saved_addresses
for update using (auth.uid() = user_id);

commit;
