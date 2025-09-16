begin;

create type if not exists public.offer_status as enum ('sent','accepted','rejected','expired','canceled','paid');

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  service_date timestamptz,
  currency text not null default 'MXN',
  amount numeric(12,2) not null,
  status public.offer_status not null default 'sent',
  reject_reason text,
  checkout_url text,
  payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint offers_status_requires_client check (client_id = created_by)
);

create index if not exists idx_offers_conversation_created on public.offers(conversation_id, created_at desc);
create index if not exists idx_offers_professional_status on public.offers(professional_id, status);
create index if not exists idx_offers_client_status on public.offers(client_id, status);

alter table public.offers enable row level security;

drop policy if exists offers_select_participants_only on public.offers;
create policy offers_select_participants_only on public.offers
for select using (
  exists (
    select 1 from public.conversations c
    where c.id = offers.conversation_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  )
);

drop policy if exists offers_insert_client_only on public.offers;
create policy offers_insert_client_only on public.offers
for insert with check (
  auth.uid() = created_by
  and auth.uid() = client_id
  and exists (
    select 1 from public.conversations c
    where c.id = offers.conversation_id
      and c.customer_id = auth.uid()
  )
);

drop policy if exists offers_update_pro_only on public.offers;
create policy offers_update_pro_only on public.offers
for update using (
  auth.uid() = professional_id
)
with check (
  auth.uid() = professional_id
);

drop policy if exists offers_update_client_cancel on public.offers;
create policy offers_update_client_cancel on public.offers
for update using (
  auth.uid() = client_id and status = 'sent'
)
with check (
  auth.uid() = client_id
);

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists payload jsonb not null default '{}'::jsonb;

create or replace function public.on_offer_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
    values (
      NEW.conversation_id,
      NEW.client_id,
      coalesce(NEW.title, 'Oferta enviada'),
      'offer',
      jsonb_build_object(
        'offer_id', NEW.id,
        'title', NEW.title,
        'description', NEW.description,
        'amount', NEW.amount,
        'currency', NEW.currency,
        'service_date', NEW.service_date,
        'status', NEW.status,
        'actions', case when NEW.status = 'sent' then jsonb_build_array('accept','reject') else jsonb_build_array() end
      ),
      now()
    );
    update public.conversations set last_message_at = now() where id = NEW.conversation_id;
    return NEW;
  elsif (TG_OP = 'UPDATE') then
    if NEW.status is distinct from OLD.status then
      if NEW.status = 'accepted' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.professional_id,
          'Oferta aceptada',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status,
            'checkout_url', NEW.checkout_url
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'rejected' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.professional_id,
          case when coalesce(NEW.reject_reason, '') = '' then 'Oferta rechazada' else 'Oferta rechazada: ' || NEW.reject_reason end,
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status,
            'reason', NEW.reject_reason
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'paid' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.client_id,
          'Pago recibido. ?Gracias!',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'canceled' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.client_id,
          'Oferta cancelada',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'expired' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.client_id,
          'Oferta expirada',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      end if;
    end if;
    NEW.updated_at := now();
    return NEW;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_offer_status on public.offers;
create trigger trg_offer_status
after insert or update on public.offers
for each row execute function public.on_offer_status_change();

commit;


