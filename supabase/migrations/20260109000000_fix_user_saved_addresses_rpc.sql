begin;

create extension if not exists "pgcrypto";

-- Drop any lingering overloads safely (no-op if none exist)
do $$
declare
  r record;
begin
  for r in
    select oid::regprocedure as func_name
    from pg_proc
    where proname = 'upsert_user_address'
  loop
    execute format('drop function %s', r.func_name);
  end loop;
end;
$$;

create table if not exists public.user_saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address_line text not null,
  address_place_id text,
  lat double precision,
  lng double precision,
  label text,
  times_used integer not null default 1,
  last_used_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_saved_addresses_user_id_idx
  on public.user_saved_addresses(user_id);

create unique index if not exists ux_user_saved_addresses_user_line
  on public.user_saved_addresses(user_id, address_line);

create unique index if not exists ux_user_saved_addresses_user_place
  on public.user_saved_addresses(user_id, address_place_id)
  where address_place_id is not null;

alter table public.user_saved_addresses enable row level security;

drop policy if exists "select own addresses" on public.user_saved_addresses;
drop policy if exists "insert own addresses" on public.user_saved_addresses;
drop policy if exists "update own addresses" on public.user_saved_addresses;
drop policy if exists "delete own addresses" on public.user_saved_addresses;

create policy "select own addresses"
  on public.user_saved_addresses
  for select
  using (auth.uid() = user_id);

create policy "insert own addresses"
  on public.user_saved_addresses
  for insert
  with check (auth.uid() = user_id);

create policy "update own addresses"
  on public.user_saved_addresses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own addresses"
  on public.user_saved_addresses
  for delete
  using (auth.uid() = user_id);

create or replace function public.upsert_user_address(
  address_line text,
  address_place_id text default null,
  label text default null,
  lat double precision default null,
  lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_place text := nullif(address_place_id, '');
  v_line text := address_line;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if v_place is not null then
    select id into v_id
    from public.user_saved_addresses usa
    where usa.user_id = v_user_id and usa.address_place_id = v_place
    limit 1;
  end if;

  if v_id is null then
    select id into v_id
    from public.user_saved_addresses usa
    where usa.user_id = v_user_id and usa.address_line = v_line
    limit 1;
  end if;

  if v_id is not null then
    update public.user_saved_addresses usa
    set last_used_at = now(),
        updated_at = now(),
        times_used = coalesce(usa.times_used, 0) + 1,
        address_place_id = coalesce(v_place, usa.address_place_id),
        lat = coalesce(lat, usa.lat),
        lng = coalesce(lng, usa.lng),
        label = coalesce(nullif(label, ''), usa.label)
    where usa.id = v_id;
  else
    insert into public.user_saved_addresses (
      user_id, address_line, address_place_id, lat, lng, label, last_used_at, times_used
    ) values (
      v_user_id, v_line, v_place, lat, lng, nullif(label, ''), now(), 1
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.upsert_user_address(
  text, text, text, double precision, double precision
) to authenticated, service_role;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';

commit;
