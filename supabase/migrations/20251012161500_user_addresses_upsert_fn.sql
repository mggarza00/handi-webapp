begin;

-- Upsert by (profile_id, md5(lower(unaccent(address)))) using ON CONFLICT
create or replace function public.upsert_user_address_book(
  p_address text,
  p_city text default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_postal_code text default null,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_id uuid;
begin
  if v_profile_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.user_addresses (
    profile_id, address, city, lat, lon, postal_code, label, last_used_at, times_used
  ) values (
    v_profile_id, p_address, nullif(p_city, ''), p_lat, p_lon, nullif(p_postal_code, ''), nullif(p_label, ''), now(), 1
  )
  on conflict on constraint user_addresses_unique_per_user_idx
  do update set
    times_used = public.user_addresses.times_used + 1,
    last_used_at = now(),
    updated_at = now(),
    city = coalesce(excluded.city, public.user_addresses.city),
    lat = coalesce(excluded.lat, public.user_addresses.lat),
    lon = coalesce(excluded.lon, public.user_addresses.lon),
    postal_code = coalesce(excluded.postal_code, public.user_addresses.postal_code),
    label = coalesce(excluded.label, public.user_addresses.label)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.upsert_user_address_book(text, text, double precision, double precision, text, text) to authenticated;

commit;

