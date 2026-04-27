begin;

create or replace function public.on_quote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
    values (
      new.conversation_id,
      new.professional_id,
      'Cotización enviada',
      'quote',
      jsonb_build_object(
        'quote_id', new.id,
        'items', new.items,
        'total', new.total,
        'currency', coalesce(new.currency, 'MXN'),
        'image_path', new.image_path,
        'status', new.status,
        'folio', new.folio
      ),
      now()
    );
    update public.conversations set last_message_at = now() where id = new.conversation_id;
    return new;
  elsif (tg_op = 'UPDATE') then
    if (new.status is distinct from old.status) then
      insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
      values (
        new.conversation_id,
        case when new.status in ('accepted','rejected') then new.client_id else new.professional_id end,
        case new.status
          when 'accepted' then 'Cotización aceptada'
          when 'rejected' then 'Cotización rechazada'
          when 'expired' then 'Cotización expirada'
          when 'canceled' then 'Cotización cancelada'
          else 'Actualización de cotización'
        end,
        'system',
        jsonb_build_object('quote_id', new.id, 'status', new.status),
        now()
      );
      update public.conversations set last_message_at = now() where id = new.conversation_id;
    end if;
    new.updated_at := now();
    return new;
  end if;
  return new;
end;
$$;

update public.messages
set body = replace(body, 'CotizaciÃ³n', 'Cotización')
where body like '%CotizaciÃ³n%';

update public.messages
set body = replace(body, 'ActualizaciÃ³n de cotizaciÃ³n', 'Actualización de cotización')
where body like '%ActualizaciÃ³n de cotizaciÃ³n%';

commit;
