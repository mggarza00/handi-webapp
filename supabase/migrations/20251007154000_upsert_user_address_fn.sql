begin;

create or replace function public.upsert_user_address(
  p_address_line text,
  p_address_place_id text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_label text default null
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

  -- Buscar coincidencia por place_id si existe
  if p_address_place_id is not null and btrim(p_address_place_id) <> '' then
    select id into v_id
    from public.user_saved_addresses
    where user_id = v_user_id and address_place_id = p_address_place_id
    limit 1;
  end if;

  -- Si no hubo match, buscar por address_line exacto
  if v_id is null then
    select id into v_id
    from public.user_saved_addresses
    where user_id = v_user_id and address_line = p_address_line
    limit 1;
  end if;

  if v_id is not null then
    update public.user_saved_addresses
    set last_used_at = now(),
        address_place_id = coalesce(nullif(p_address_place_id, ''), public.user_saved_addresses.address_place_id),
        lat = coalesce(p_lat, public.user_saved_addresses.lat),
        lng = coalesce(p_lng, public.user_saved_addresses.lng),
        label = coalesce(p_label, public.user_saved_addresses.label)
    where id = v_id;
  else
    insert into public.user_saved_addresses (user_id, address_line, address_place_id, lat, lng, label, last_used_at)
    values (v_user_id, p_address_line, nullif(p_address_place_id, ''), p_lat, p_lng, p_label, now())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.upsert_user_address(text, text, double precision, double precision, text) to authenticated;

commit;
