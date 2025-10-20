-- RPC: acepta una oferta de forma atómica con validaciones de negocio
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
  -- 0) Requisitos previos
  if p_offer_id is null or p_actor is null then
    return json_build_object('ok', false, 'error', 'bad_params');
  end if;

  -- 1) Candado de cuenta bancaria confirmada
  if not public.has_confirmed_bank_account(p_actor) then
    return json_build_object('ok', false, 'error', 'bank_account_required');
  end if;

  -- 2) Toma la oferta con FOR UPDATE (evita carreras)
  select professional_id, status::text
  into v_professional, v_status
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'offer_not_found');
  end if;

  -- 3) Propiedad y estado válido (en este esquema, 'sent' → aceptable)
  if v_professional <> p_actor then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_status <> 'sent' then
    return json_build_object('ok', false, 'error', 'invalid_state');
  end if;

  -- 4) Actualiza estado a accepted
  update public.offers
  set status = 'accepted'
  where id = p_offer_id;

  return json_build_object('ok', true);
end;
$$;

-- Permisos de ejecución para usuarios autenticados (ajusta si usas otro rol)
grant execute on function public.accept_offer_tx(uuid, uuid) to authenticated;

