-- Migration: messages table + RLS for chat con candado (persistencia mínima)
begin;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

-- Select: sólo las partes de la conversación
drop policy if exists "messages.select.parties" on public.messages;
create policy "messages.select.parties" on public.messages
for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

-- Insert: debe ser el emisor y pertenecer a un par válido (dueño del request y profesional con application)
drop policy if exists "messages.insert.parties_with_application" on public.messages;
create policy "messages.insert.parties_with_application" on public.messages
for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.applications a
    join public.requests r on r.id = a.request_id
    where a.request_id = messages.request_id
      and (
        (a.professional_id = messages.sender_id and r.created_by = messages.recipient_id)
        or
        (a.professional_id = messages.recipient_id and r.created_by = messages.sender_id)
      )
  )
);

create index if not exists ix_messages_request_created on public.messages (request_id, created_at desc);

commit;

