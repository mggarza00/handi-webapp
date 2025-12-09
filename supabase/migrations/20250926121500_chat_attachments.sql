-- Chat attachments: DB objects, RLS, and Storage bucket/policies
begin;

-- 1) Security helper: is the current user a participant in the conversation?
-- Our schema uses customer_id and pro_id in public.conversations
create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = conv_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  );
$$;

-- 2) Attachments table
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null,   -- e.g. conversation/<convId>/<msgId>/<fileName>
  filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  width int,
  height int,
  sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_attachments_message_id on public.message_attachments(message_id);
create index if not exists idx_message_attachments_conversation_id on public.message_attachments(conversation_id);

alter table public.message_attachments enable row level security;

-- Maintain messages.attachment_count automatically
create or replace function public.tg_update_message_attachment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.messages
      set attachment_count = coalesce(attachment_count, 0) + 1
      where id = new.message_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.messages
      set attachment_count = greatest(coalesce(attachment_count, 0) - 1, 0)
      where id = old.message_id;
    return old;
  else
    return null;
  end if;
end $$;

drop trigger if exists trg_messages_attachment_count_ins on public.message_attachments;
create trigger trg_messages_attachment_count_ins
after insert on public.message_attachments
for each row execute function public.tg_update_message_attachment_count();

drop trigger if exists trg_messages_attachment_count_del on public.message_attachments;
create trigger trg_messages_attachment_count_del
after delete on public.message_attachments
for each row execute function public.tg_update_message_attachment_count();

-- RLS: select if participant in the conversation
drop policy if exists "attachments_select_participants_only" on public.message_attachments;
create policy "attachments_select_participants_only"
on public.message_attachments
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

-- RLS: insert if participant and uploader is current user
drop policy if exists "attachments_insert_participants_only" on public.message_attachments;
create policy "attachments_insert_participants_only"
on public.message_attachments
for insert
to authenticated
with check (
  public.is_conversation_participant(conversation_id)
  and uploader_id = auth.uid()
);

-- RLS: delete own attachment (admins/moderators can be added later if needed)
drop policy if exists "attachments_delete_owner" on public.message_attachments;
create policy "attachments_delete_owner"
on public.message_attachments
for delete
to authenticated
using (uploader_id = auth.uid());

-- Optional: convenience for UI counters
alter table public.messages add column if not exists attachment_count int not null default 0;

commit;

-- 3) Supabase Storage: private bucket for chat attachments + policies
-- Use create_bucket when available; otherwise, fallback to inserting into storage.buckets
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'chat-attachments') then
    begin
      perform storage.create_bucket(
        id => 'chat-attachments'::text,
        name => 'chat-attachments'::text,
        public => false,
        file_size_limit => 20971520::bigint, -- 20MB per file
        allowed_mime_types => ARRAY[
          'image/*',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword'
        ]::text[]
      );
    exception when undefined_function then
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'chat-attachments',
        'chat-attachments',
        false,
        20971520::bigint,
        ARRAY[
          'image/*',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword'
        ]::text[]
      )
      on conflict (id) do update set
        name = excluded.name,
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    end;
  end if;
end
$$;

-- Clean any previous policies with same names
do $$ begin
  if exists (select 1 from pg_policy where polname = 'chat_attachments_select_participants') then
    drop policy "chat_attachments_select_participants" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'chat_attachments_insert_participants_prefix') then
    drop policy "chat_attachments_insert_participants_prefix" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'chat_attachments_delete_owner') then
    drop policy "chat_attachments_delete_owner" on storage.objects;
  end if;
end $$;

-- Read: only conversation participants can read objects of that conversation
-- Path convention inside bucket: conversation/<convId>/<msgId>/<filename>
create policy "chat_attachments_select_participants" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and split_part(name, '/', 1) = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id::text = split_part(name, '/', 2)
        and public.is_conversation_participant(c.id)
    )
  );

-- Insert: participants may upload under the expected prefix; enforce owner and path shape
create policy "chat_attachments_insert_participants_prefix" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and owner = auth.uid()
    and split_part(name, '/', 1) = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id::text = split_part(name, '/', 2)
        and public.is_conversation_participant(c.id)
    )
  );

-- Delete: owner may delete their own objects under this bucket
create policy "chat_attachments_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-attachments'
    and owner = auth.uid()
  );
