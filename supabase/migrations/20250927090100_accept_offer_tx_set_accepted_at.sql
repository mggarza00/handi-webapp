create or replace function public.accept_offer_tx(p_offer_id uuid, p_actor uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional uuid;
  v_status text;
begin
  if p_offer_id is null or p_actor is null then
    return json_build_object('ok', false, 'error', 'bad_params');
  end if;

  if not public.has_confirmed_bank_account(p_actor) then
    return json_build_object('ok', false, 'error', 'bank_account_required');
  end if;

  select professional_id, status::text
  into v_professional, v_status
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'offer_not_found');
  end if;

  if v_professional <> p_actor then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_status <> 'pending' then
    return json_build_object('ok', false, 'error', 'invalid_state');
  end if;

  update public.offers
     set status = 'accepted',
         accepted_at = now()
   where id = p_offer_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.accept_offer_tx(uuid, uuid) to authenticated;

