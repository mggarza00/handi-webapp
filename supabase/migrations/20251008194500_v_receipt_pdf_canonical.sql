-- Canonical receipt view: prioritizes receipts and receipt_items
drop view if exists public.v_receipt_pdf;
create or replace view public.v_receipt_pdf as
with li as (
  select
    ri.receipt_id,
    sum(case when lower(ri.item_type) in ('service','servicio') then ri.amount_cents else 0 end)::bigint as service_amount,
    sum(case when lower(ri.item_type) in ('commission','comision','comisión') then ri.amount_cents else 0 end)::bigint as commission_amount,
    sum(case when lower(ri.item_type) in ('iva','tax') then ri.amount_cents else 0 end)::bigint as iva_amount,
    sum(ri.amount_cents)::bigint as line_items_total
  from public.receipt_items ri
  group by 1
)
select
  r.id                                          as receipt_id,
  r.created_at,
  coalesce(r.folio, null)                       as folio,
  coalesce(r.currency, 'MXN')                   as currency,
  coalesce(r.service_amount_cents,   li.service_amount,   0)::bigint as service_amount,
  coalesce(r.commission_amount_cents,li.commission_amount,0)::bigint as commission_amount,
  coalesce(r.iva_amount_cents,       li.iva_amount,       0)::bigint as iva_amount,
  coalesce(r.total_amount_cents,
           (coalesce(r.service_amount_cents,   li.service_amount,   0)
          + coalesce(r.commission_amount_cents,li.commission_amount,0)
          + coalesce(r.iva_amount_cents,       li.iva_amount,       0)))::bigint        as total_amount,
  u_client.full_name                            as client_name,
  u_client.email                                as client_email,
  u_pro.full_name                               as professional_name,
  req.title                                     as service_title,
  nullif(req.description, '')                   as service_description,
  req.id                                        as request_id
from public.receipts r
left join li                     on li.receipt_id = r.id
left join public.requests req    on req.id = r.request_id
left join public.profiles u_client on u_client.id = r.client_id
left join public.profiles u_pro    on u_pro.id    = r.professional_id;

-- Basic grants (adjust to your roles)
do $$ begin
  execute 'grant select on public.v_receipt_pdf to anon';
  execute 'grant select on public.v_receipt_pdf to authenticated';
  execute 'grant select on public.v_receipt_pdf to service_role';
exception when others then null; end $$;
