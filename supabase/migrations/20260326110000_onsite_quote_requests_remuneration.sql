begin;

-- Expand onsite quote requests to support remunerable credit lifecycle.
alter table public.onsite_quote_requests
  add column if not exists details text,
  add column if not exists is_remunerable boolean not null default false,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists remuneration_applied_offer_id uuid references public.offers(id) on delete set null,
  add column if not exists remuneration_applied_at timestamptz,
  add column if not exists deposit_base_cents integer,
  add column if not exists deposit_fee_cents integer,
  add column if not exists deposit_iva_cents integer,
  add column if not exists deposit_total_cents integer;

-- Backfill details from legacy notes when present.
update public.onsite_quote_requests
set details = notes
where details is null
  and notes is not null
  and length(trim(notes)) > 0;

-- Backfill paid timestamp for existing paid rows.
update public.onsite_quote_requests
set deposit_paid_at = coalesce(updated_at, created_at, now())
where status = 'deposit_paid'
  and deposit_paid_at is null;

-- Data quality constraints.
alter table public.onsite_quote_requests
  drop constraint if exists onsite_quote_requests_status_check;
alter table public.onsite_quote_requests
  add constraint onsite_quote_requests_status_check
  check (status in (
    'requested',
    'scheduled',
    'accepted',
    'rejected',
    'deposit_pending',
    'deposit_paid',
    'no_show',
    'completed',
    'canceled'
  ));

alter table public.onsite_quote_requests
  drop constraint if exists onsite_quote_requests_remuneration_pair_check;
alter table public.onsite_quote_requests
  add constraint onsite_quote_requests_remuneration_pair_check
  check (
    (remuneration_applied_offer_id is null and remuneration_applied_at is null)
    or
    (remuneration_applied_offer_id is not null and remuneration_applied_at is not null)
  );

alter table public.onsite_quote_requests
  drop constraint if exists onsite_quote_requests_deposit_cents_nonnegative_check;
alter table public.onsite_quote_requests
  add constraint onsite_quote_requests_deposit_cents_nonnegative_check
  check (
    (deposit_base_cents is null or deposit_base_cents >= 0)
    and (deposit_fee_cents is null or deposit_fee_cents >= 0)
    and (deposit_iva_cents is null or deposit_iva_cents >= 0)
    and (deposit_total_cents is null or deposit_total_cents >= 0)
  );

-- One paid + remunerable + not-yet-applied onsite request eligible per conversation.
create unique index if not exists onsite_one_eligible_credit_per_conversation_idx
on public.onsite_quote_requests(conversation_id)
where status = 'deposit_paid'
  and is_remunerable = true
  and remuneration_applied_at is null;

-- A final offer can consume at most one onsite remunerable credit.
create unique index if not exists onsite_one_credit_per_offer_idx
on public.onsite_quote_requests(remuneration_applied_offer_id)
where remuneration_applied_offer_id is not null;

-- Refresh chat payload trigger with new onsite fields.
create or replace function public.on_onsite_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  body_text text;
  payload jsonb;
  normalized_details text;
begin
  normalized_details := coalesce(new.details, new.notes);
  if (tg_op = 'INSERT') then
    body_text := 'Solicitud de cotizacion en sitio';
    payload := jsonb_build_object(
      'onsite_request_id', new.id,
      'status', new.status,
      'schedule_date', new.schedule_date,
      'schedule_time_start', new.schedule_time_start,
      'schedule_time_end', new.schedule_time_end,
      'notes', new.notes,
      'details', normalized_details,
      'is_remunerable', new.is_remunerable,
      'deposit_amount', new.deposit_amount
    );
    insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
    values (new.conversation_id, new.professional_id, body_text, 'system', payload, now());
    update public.conversations set last_message_at = now() where id = new.conversation_id;
    return new;
  elsif (tg_op = 'UPDATE') then
    if (new.status is distinct from old.status) then
      body_text := case new.status
        when 'deposit_pending' then 'Deposito requerido (cotizacion en sitio)'
        when 'deposit_paid' then 'Deposito pagado'
        when 'accepted' then 'Cotizacion en sitio aceptada'
        when 'rejected' then 'Cotizacion en sitio rechazada'
        when 'scheduled' then 'Visita agendada'
        when 'no_show' then 'Cliente no presente'
        when 'completed' then 'Visita finalizada'
        when 'canceled' then 'Visita cancelada'
        else 'Actualizacion de solicitud en sitio'
      end;
      payload := jsonb_build_object(
        'onsite_request_id', new.id,
        'status', new.status,
        'deposit_amount', new.deposit_amount,
        'details', normalized_details,
        'is_remunerable', new.is_remunerable,
        'checkout_url', new.deposit_checkout_url
      );
      insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
      values (new.conversation_id, coalesce(new.client_id, new.professional_id), body_text, 'system', payload, now());
      update public.conversations set last_message_at = now() where id = new.conversation_id;
    end if;
    new.updated_at := now();
    return new;
  end if;
  return new;
end;
$$;

commit;
