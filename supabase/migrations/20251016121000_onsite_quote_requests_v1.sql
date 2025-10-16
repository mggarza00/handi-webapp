-- solicitudes de "cotizar en sitio" con depósito
begin;

create table if not exists public.onsite_quote_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  professional_id uuid not null references public.profiles(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'requested',
  -- requested|scheduled|accepted|rejected|deposit_pending|deposit_paid|no_show|completed|canceled
  schedule_date date,
  schedule_time_start int,  -- 0..23
  schedule_time_end int,    -- 1..24
  notes text,
  deposit_amount numeric not null default 200,
  deposit_checkout_url text,
  deposit_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onsite_conversation on public.onsite_quote_requests(conversation_id);
create index if not exists idx_onsite_status on public.onsite_quote_requests(status);

alter table public.onsite_quote_requests enable row level security;

-- Lectura: solo participantes
drop policy if exists onsite_requests_participants_read on public.onsite_quote_requests;
create policy onsite_requests_participants_read on public.onsite_quote_requests
for select using (
  exists (
    select 1 from public.conversations c
    where c.id = onsite_quote_requests.conversation_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  )
);

-- Insert: solo el profesional participante puede crear la solicitud
drop policy if exists onsite_requests_professional_insert on public.onsite_quote_requests;
create policy onsite_requests_professional_insert on public.onsite_quote_requests
for insert with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.pro_id = auth.uid()
  )
);

-- Update: ambos participantes (reglas de negocio en API)
drop policy if exists onsite_requests_participants_update on public.onsite_quote_requests;
create policy onsite_requests_participants_update on public.onsite_quote_requests
for update using (
  exists (
    select 1 from public.conversations c
    where c.id = onsite_quote_requests.conversation_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = onsite_quote_requests.conversation_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  )
);

-- Trigger: mensajes en chat
create or replace function public.on_onsite_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  body_text text;
  payload jsonb;
begin
  if (tg_op = 'INSERT') then
    body_text := 'Solicitud de cotización en sitio';
    payload := jsonb_build_object(
      'onsite_request_id', new.id,
      'status', new.status,
      'schedule_date', new.schedule_date,
      'schedule_time_start', new.schedule_time_start,
      'schedule_time_end', new.schedule_time_end,
      'notes', new.notes,
      'deposit_amount', new.deposit_amount
    );
    insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
    values (new.conversation_id, new.professional_id, body_text, 'system', payload, now());
    update public.conversations set last_message_at = now() where id = new.conversation_id;
    return new;
  elsif (tg_op = 'UPDATE') then
    if (new.status is distinct from old.status) then
      body_text := case new.status
        when 'deposit_pending' then 'Depósito requerido (cotización en sitio)'
        when 'deposit_paid' then 'Depósito pagado'
        when 'accepted' then 'Cotización en sitio aceptada'
        when 'rejected' then 'Cotización en sitio rechazada'
        when 'scheduled' then 'Visita agendada'
        when 'no_show' then 'Cliente no presente'
        when 'completed' then 'Visita finalizada'
        when 'canceled' then 'Visita cancelada'
        else 'Actualización de solicitud en sitio'
      end;
      payload := jsonb_build_object(
        'onsite_request_id', new.id,
        'status', new.status,
        'deposit_amount', new.deposit_amount,
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

drop trigger if exists trg_onsite_request_change on public.onsite_quote_requests;
create trigger trg_onsite_request_change
after insert or update on public.onsite_quote_requests
for each row execute function public.on_onsite_request_change();

commit;

