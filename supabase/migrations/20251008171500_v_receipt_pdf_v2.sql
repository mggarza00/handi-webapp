-- v2: Enhance receipt PDF view with client email and better title fallback
create or replace view public.v_receipt_pdf as
select
  (m.payload->>'receipt_id')                 as receipt_id,
  coalesce(m.payload->>'receipt_id', m.id::text) as folio,
  m.created_at                              as created_at,

  -- Request (servicio)
  c.request_id                              as request_id,
  coalesce(req.title, off.title)            as service_title,
  nullif(trim(req.description), '')         as service_description,

  -- Cliente
  pc.full_name                              as client_name,
  pc.email                                  as client_email,

  -- Profesional
  pp.full_name                              as professional_name,

  -- Desglose (servicio desde última oferta pagada; comision/iva 0 si no hay)
  coalesce(off.amount, 0)::numeric          as servicio_mxn,
  0::numeric                                as comision_mxn,
  0::numeric                                as iva_mxn,
  coalesce(off.amount, 0)::numeric          as total_mxn

from public.messages m
join public.conversations c on c.id = m.conversation_id
left join public.requests req on req.id = c.request_id
left join public.profiles pc on pc.id = c.customer_id
left join public.profiles pp on pp.id = c.pro_id
left join public.offers off on off.conversation_id = c.id and off.status = 'paid'
where m.message_type = 'system' and (m.payload->>'receipt_id') is not null;
