-- quotes: cotizaciones formales con imagen
begin;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  currency text not null default 'MXN',
  items jsonb not null, -- [{concept:text, amount:numeric}]
  total numeric not null,
  image_path text, -- storage path (e.g. quotes/... or chat-attachments/...)
  status text not null default 'sent', -- sent|accepted|rejected|expired|canceled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_conversation on public.quotes(conversation_id);
create index if not exists idx_quotes_professional on public.quotes(professional_id);
create index if not exists idx_quotes_client on public.quotes(client_id);

alter table public.quotes enable row level security;

-- Solo participantes de la conversación pueden leer
drop policy if exists quotes_participants_read on public.quotes;
create policy quotes_participants_read
on public.quotes
for select
using (
  exists (
    select 1 from public.conversations c
    where c.id = quotes.conversation_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  )
);

-- Insert: solo el profesional participante puede crear la cotización
drop policy if exists quotes_professional_insert on public.quotes;
create policy quotes_professional_insert
on public.quotes
for insert
with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.pro_id = auth.uid()
  )
);

-- Update: ambos participantes pueden actualizar estado/campos (validación en capa de API)
drop policy if exists quotes_participants_update on public.quotes;
create policy quotes_participants_update
on public.quotes
for update
using (
  exists (
    select 1 from public.conversations c
    where c.id = quotes.conversation_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = quotes.conversation_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  )
);

-- Trigger: mensajes automáticos en chat para nuevas cotizaciones y cambios de estado
create or replace function public.on_quote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    -- mensaje tipo "quote"
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
        'status', new.status
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

drop trigger if exists trg_quote_change on public.quotes;
create trigger trg_quote_change
after insert or update on public.quotes
for each row execute function public.on_quote_change();

commit;

