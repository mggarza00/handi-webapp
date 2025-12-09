begin;

-- Ensure user_saved_addresses exists (idempotent)
create table if not exists public.user_saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  address_line text not null,
  address_place_id text,
  lat double precision,
  lng double precision,
  last_used_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add usage tracking columns
alter table public.user_saved_addresses
  add column if not exists times_used int not null default 0,
  alter column last_used_at set default now();

-- Backfill columns for existing deployments
alter table public.user_saved_addresses
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Helpful indexes / constraints (idempotent)
create index if not exists user_saved_addresses_user_id_idx on public.user_saved_addresses(user_id);
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'ux_user_saved_addresses_user_line'
  ) then
    create unique index ux_user_saved_addresses_user_line on public.user_saved_addresses(user_id, address_line);
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'ux_user_saved_addresses_user_place'
  ) then
    create unique index ux_user_saved_addresses_user_place on public.user_saved_addresses(user_id, address_place_id) where address_place_id is not null;
  end if;
end $$;

-- RLS (idempotent)
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

-- Update RPCs to increment times_used and refresh last_used_at
begin;

create or replace function public.upsert_user_address(
  address_line text,
  address_place_id text default null,
  lat double precision default null,
  lng double precision default null,
  label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Try match by place_id first if provided
  if address_place_id is not null and btrim(address_place_id) <> '' then
    select id into v_id
    from public.user_saved_addresses
    where user_id = v_user_id and address_place_id = address_place_id
    limit 1;
  end if;

  -- Fallback: match by exact address_line
  if v_id is null then
    select id into v_id
    from public.user_saved_addresses
    where user_id = v_user_id and address_line = address_line
    limit 1;
  end if;

  if v_id is not null then
    update public.user_saved_addresses
    set last_used_at = now(),
        updated_at = now(),
        times_used = coalesce(times_used, 0) + 1,
        address_place_id = coalesce(nullif(address_place_id, ''), public.user_saved_addresses.address_place_id),
        lat = coalesce(lat, public.user_saved_addresses.lat),
        lng = coalesce(lng, public.user_saved_addresses.lng),
        label = coalesce(label, public.user_saved_addresses.label)
    where id = v_id;
  else
    insert into public.user_saved_addresses (user_id, address_line, address_place_id, lat, lng, label, last_used_at, times_used)
    values (v_user_id, address_line, nullif(address_place_id, ''), lat, lng, label, now(), 1)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.upsert_user_address(text, text, double precision, double precision, text) to authenticated;

commit;

begin;

-- Void variant (named params with p_*)
create or replace function public.upsert_user_address(
  p_address_line text,
  p_place_id text,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  v_id uuid;
begin
  uid := auth.uid();
  if uid is null then
    return;
  end if;

  -- Find existing by place_id or line
  select id into v_id
  from public.user_saved_addresses
  where user_id = uid
    and (
      address_place_id is not distinct from nullif(p_place_id, '')
      or address_line ilike p_address_line
    )
  limit 1;

  if v_id is not null then
    update public.user_saved_addresses
      set last_used_at = now(),
          updated_at = now(),
          times_used = coalesce(times_used, 0) + 1,
          address_place_id = coalesce(nullif(p_place_id, ''), address_place_id),
          lat = coalesce(p_lat, lat),
          lng = coalesce(p_lng, lng)
    where id = v_id;
  else
    insert into public.user_saved_addresses (user_id, address_line, address_place_id, lat, lng, last_used_at, times_used)
    values (uid, p_address_line, nullif(p_place_id, ''), p_lat, p_lng, now(), 1);
  end if;
end;
$$;

grant execute on function public.upsert_user_address(text, text, double precision, double precision) to authenticated;

commit;
