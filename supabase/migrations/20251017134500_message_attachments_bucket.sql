-- Create private bucket `message-attachments` and storage policies mirroring chat attachments
begin;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'message-attachments') then
    begin
      perform storage.create_bucket(
        id => 'message-attachments'::text,
        name => 'message-attachments'::text,
        public => false,
        file_size_limit => 20971520::bigint, -- 20MB
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
        'message-attachments',
        'message-attachments',
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

-- Drop old policies if exist (prevent duplicates)
do $$ begin
  if exists (select 1 from pg_policy where polname = 'message_attachments_select_participants') then
    drop policy "message_attachments_select_participants" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'message_attachments_insert_participants_prefix') then
    drop policy "message_attachments_insert_participants_prefix" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'message_attachments_delete_owner') then
    drop policy "message_attachments_delete_owner" on storage.objects;
  end if;
end $$;

-- Read policy: participants of the conversation can read files under conversation/<convId>/
create policy "message_attachments_select_participants" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and split_part(name, '/', 1) = 'conversation'
    and exists (
      select 1 from public.conversations c
      where c.id::text = split_part(name, '/', 2)
        and public.is_conversation_participant(c.id)
    )
  );

-- Insert policy: participants can upload under the expected prefix and must be the owner
create policy "message_attachments_insert_participants_prefix" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and owner = auth.uid()
    and split_part(name, '/', 1) = 'conversation'
    and exists (
      select 1 from public.conversations c
      where c.id::text = split_part(name, '/', 2)
        and public.is_conversation_participant(c.id)
    )
  );

-- Delete policy: owner may delete their own objects
create policy "message_attachments_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and owner = auth.uid()
  );

commit;

