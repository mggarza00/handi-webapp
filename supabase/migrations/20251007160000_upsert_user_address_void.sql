begin;

-- Variante opcional (void) con parámetros p_*
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
begin
  uid := auth.uid();
  if uid is null then
    return;
  end if;

  if exists (
    select 1
    from public.user_saved_addresses
    where user_id = uid
      and (
        address_place_id is not distinct from nullif(p_place_id, '')
        or address_line ilike p_address_line
      )
  ) then
    update public.user_saved_addresses
      set last_used_at = now()
    where user_id = uid
      and (
        address_place_id is not distinct from nullif(p_place_id, '')
        or address_line ilike p_address_line
      );
  else
    insert into public.user_saved_addresses (user_id, address_line, address_place_id, lat, lng, last_used_at)
    values (uid, p_address_line, nullif(p_place_id, ''), p_lat, p_lng, now());
  end if;
end;
$$;

grant execute on function public.upsert_user_address(text, text, double precision, double precision) to authenticated;

commit;

