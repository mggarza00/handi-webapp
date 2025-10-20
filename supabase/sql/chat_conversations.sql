-- Conversations + extended messages for contextual chat (copy for manual apply)
begin;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  pro_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (request_id, customer_id, pro_id)
);

create index if not exists idx_conversations_customer on public.conversations(customer_id);
create index if not exists idx_conversations_pro on public.conversations(pro_id);
create index if not exists idx_conversations_request on public.conversations(request_id);
create index if not exists idx_conversations_last on public.conversations(last_message_at desc);

alter table public.conversations enable row level security;

drop policy if exists "participants can select their conversations" on public.conversations;
create policy "participants can select their conversations"
on public.conversations for select
using (
  auth.uid() = customer_id or auth.uid() = pro_id
);

drop policy if exists "participants can insert conversations" on public.conversations;
create policy "participants can insert conversations"
on public.conversations for insert
with check (auth.uid() = customer_id or auth.uid() = pro_id);

drop policy if exists "participants can update last_message_at" on public.conversations;
create policy "participants can update last_message_at"
on public.conversations for update
using (auth.uid() = customer_id or auth.uid() = pro_id)
with check (auth.uid() = customer_id or auth.uid() = pro_id);

alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists body text,
  add column if not exists read_by jsonb not null default '[]'::jsonb;

create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_created_ts on public.messages(created_at);

drop policy if exists "messages.select.by_conversation" on public.messages;
create policy "messages.select.by_conversation" on public.messages
for select using (
  conversation_id is not null and conversation_id in (
    select id from public.conversations
    where customer_id = auth.uid() or pro_id = auth.uid()
  )
);

drop policy if exists "messages.insert.by_conversation" on public.messages;
create policy "messages.insert.by_conversation" on public.messages
for insert with check (
  conversation_id is not null and conversation_id in (
    select id from public.conversations
    where customer_id = auth.uid() or pro_id = auth.uid()
  ) and sender_id = auth.uid()
);

drop policy if exists "messages.update.read_by_by_participant" on public.messages;
create policy "messages.update.read_by_by_participant" on public.messages
for update using (
  conversation_id is not null and conversation_id in (
    select id from public.conversations
    where customer_id = auth.uid() or pro_id = auth.uid()
  )
);

commit;

